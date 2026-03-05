"""
FastAPI RAG Server with Streaming Document Upload and Query.
No disk storage - all documents processed in-memory!

Run with: uvicorn app:app --reload
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse
from typing import Optional
import asyncio
import time
import uuid

# Import configs
from config import (
    EMBEDDING_CONFIG, VECTOR_DB_CONFIG, LLM_CONFIG,
    RAG_CONFIG, DOCUMENT_CONFIG, API_CONFIG
)

# Import core modules from src/
from src.embeddings import get_embedding_provider
from src.vector_databases import get_vector_database
from src.document_parsers import (
    auto_detect_and_parse, chunk_text, clean_text,
    validate_file_size, get_file_info
)
from src.models import (
    QueryRequest, QueryResponse, UploadResponse, StatusResponse,
    FAQsResponse, FAQCategoryData, FAQEntry,
    ProjectCreate, ProjectResponse, ProjectListResponse,
)
from src.llm import create_llm_client, generate_answer
from src.query_utils import normalize_query
from src.faq_generator import generate_faqs
from src.faq_db import (
    setup_faq_table, store_faqs, get_all_faqs,
    upsert_chat_faq, delete_faq_by_id, delete_chat_faqs,
)  # search_faq removed (ISSUE_022)
from src.project_manager import (
    create_project, list_projects, get_project,
    delete_project, get_or_create_default_project,
)

# =============================================================================
# FASTAPI APP INITIALIZATION
# =============================================================================

app = FastAPI(
    title="RAG API Server",
    description="Retrieval Augmented Generation API with streaming document processing",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CONFIG["cors_origins"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key enforcement (ISSUE_002) — only active when API_KEY env var is set.
# Docs/root paths are exempt so Swagger UI stays accessible.
_EXEMPT_PATHS = {"/", "/docs", "/openapi.json", "/redoc"}

class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.url.path not in _EXEMPT_PATHS:
            key = request.headers.get("X-API-Key")
            if key != API_CONFIG["api_key"]:
                return JSONResponse(
                    {"detail": "Invalid or missing API key"},
                    status_code=401
                )
        return await call_next(request)

if API_CONFIG.get("api_key"):
    app.add_middleware(APIKeyMiddleware)

# =============================================================================
# GLOBAL STATE - Vector Store, Embeddings, LLM, and FAQ DB
# =============================================================================

print("\n" + "=" * 80)
print("Initializing RAG System...")
print("=" * 80)

# Initialize embedding provider
embedder = get_embedding_provider(EMBEDDING_CONFIG)
print(f"✓ Embedding model: {embedder.get_model_name()} ({embedder.get_dimensions()} dims)")

# Initialize vector database
vector_db = get_vector_database(VECTOR_DB_CONFIG, embedder.get_dimensions())
print(f"✓ Vector database: {VECTOR_DB_CONFIG['provider']}")

# Initialize LLM client
llm_client = create_llm_client()
print(f"✓ LLM: {LLM_CONFIG['model']} ({LLM_CONFIG['provider'].title()})")

# Upload counter (for /status only; doc IDs use uuid4)
document_counter = {"count": 0}

# FAQ DB connection — reuse the psycopg2 connection from PgVectorDatabase
db_conn = None
default_project_id = None
if VECTOR_DB_CONFIG["provider"] == "pgvector":
    try:
        db_conn = vector_db.conn  # PgVectorDatabase exposes its psycopg2 connection
        setup_faq_table(db_conn)
        default_project_id = get_or_create_default_project(db_conn)
        print(f"✓ FAQ table ready | Default project: {default_project_id}")
    except Exception as e:
        print(f"⚠ FAQ/Project setup failed: {e}. FAQ features disabled.")
        db_conn = None

# Startup guard (ISSUE_017): if pgvector is configured but default_project_id is
# not established, uploads without an explicit project_id would write to the wrong
# namespace (NULL project_id). Fail fast rather than silently corrupt data.
if VECTOR_DB_CONFIG["provider"] == "pgvector" and default_project_id is None:
    raise RuntimeError(
        "pgvector is configured but default_project_id could not be established. "
        "Uploads without a project_id would use NULL project scope. Aborting startup. "
        "Check PGVECTOR_CONNECTION_STRING and that the DB migration has been applied."
    )

print("=" * 80)
print("✓ RAG System Ready!")
print("=" * 80 + "\n")

# =============================================================================
# API ENDPOINTS
# =============================================================================


@app.get("/")
async def root():
    """Root endpoint - API information."""
    return {
        "name": "RAG API Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "POST /projects":                   "Create a new project",
            "GET /projects":                    "List all projects",
            "GET /projects/{project_id}":       "Get project details",
            "DELETE /projects/{project_id}":    "Delete project and all its data",
            "POST /upload":                     "Upload document (optional ?project_id=)",
            "POST /query":                      "Query knowledge base (FAQ-first, then RAG)",
            "GET /faqs":                        "Get FAQs grouped by category (optional ?project_id=)",
            "GET /status":                      "System status",
            "DELETE /reset":                    "Reset vector database",
        }
    }


# =============================================================================
# PROJECT MANAGEMENT ENDPOINTS (Phase 2)
# =============================================================================


@app.post("/projects", response_model=ProjectResponse)
async def create_new_project(body: ProjectCreate):
    """Create a new project. Returns project_id to use in upload/query/faqs."""
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        loop = asyncio.get_running_loop()
        project = await loop.run_in_executor(None, lambda: create_project(body.project_name, db_conn))
        return ProjectResponse(**project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Create project error: {e}")


@app.get("/projects", response_model=ProjectListResponse)
async def get_all_projects():
    """List all user-created projects (excludes the system Default Project)."""
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        loop = asyncio.get_running_loop()
        projects = await loop.run_in_executor(None, lambda: list_projects(db_conn))
        return ProjectListResponse(
            projects=[ProjectResponse(**p) for p in projects],
            total=len(projects),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List projects error: {e}")


@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(project_id: str):
    """Get a single project by UUID."""
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    loop = asyncio.get_running_loop()
    project = await loop.run_in_executor(None, lambda: get_project(project_id, db_conn))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)


@app.delete("/projects/{project_id}")
async def delete_project_by_id(project_id: str):
    """Delete a project and ALL its documents + FAQs (CASCADE)."""
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    if project_id == default_project_id:
        raise HTTPException(status_code=400, detail="Cannot delete the Default Project")
    loop = asyncio.get_running_loop()
    deleted = await loop.run_in_executor(None, lambda: delete_project(project_id, db_conn))
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "message": f"Project {project_id} deleted"}


@app.get("/projects/{project_id}/documents")
async def get_project_documents(project_id: str):
    """
    List all documents uploaded to a project (ISSUE_018).
    Returns distinct filenames with chunk counts and upload times.
    """
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="project_id must be a valid UUID")

    if not hasattr(vector_db, 'get_documents_list'):
        raise HTTPException(status_code=503, detail="Document listing not supported by this vector DB provider")

    loop = asyncio.get_running_loop()
    docs = await loop.run_in_executor(None, lambda: vector_db.get_documents_list(project_id))
    return {"documents": docs, "total": len(docs)}


@app.delete("/projects/{project_id}/documents/{document_id}")
async def delete_project_document(project_id: str, document_id: str):
    """
    Delete a single document's chunks and its upload-generated FAQs (ISSUE_024).
    user_chat FAQs are NOT deleted — they come from real user questions, not the file.
    """
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="project_id must be a valid UUID")

    if not hasattr(vector_db, 'delete_document'):
        raise HTTPException(status_code=503, detail="Document delete not supported by this vector DB provider")

    loop = asyncio.get_running_loop()

    # Delete vectors + get filename (so we can clean up FAQs)
    filename = await loop.run_in_executor(
        None, lambda: vector_db.delete_document(document_id, project_id)
    )

    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete FAQs generated from this document file (not user_chat FAQs)
    if db_conn is not None and filename:
        try:
            from src.faq_db import delete_faqs_by_file
            await loop.run_in_executor(
                None,
                lambda: delete_faqs_by_file(filename, db_conn, project_id=project_id)
            )
        except Exception as e:
            print(f"⚠ FAQ cleanup failed for {filename}: {e}")

    return {
        "status": "success",
        "message": f"Deleted document '{filename}' and its FAQs from project {project_id}",
        "document_id": document_id,
        "filename": filename
    }


# =============================================================================
# DOCUMENT UPLOAD
# =============================================================================


@app.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(default=None),
):
    """
    Upload and process document (streaming, in-memory).
    After embedding the document, automatically generates FAQs via LLM.

    Supported formats: PDF, DOCX, XLSX, TXT
    Max size: 50 MB (configurable in config.py)
    Pass project_id form field to scope to a project; defaults to Default Project.
    """
    # Validate project_id if provided (ISSUE_006)
    if project_id:
        try:
            uuid.UUID(project_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="project_id must be a valid UUID")

    start_time = time.time()

    try:
        # Read file bytes (streaming, no disk save)
        file_bytes = await file.read()

        # Validate file size
        max_size_mb = DOCUMENT_CONFIG["max_file_size_mb"]
        if not validate_file_size(file_bytes, max_size_mb):
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size: {max_size_mb} MB"
            )

        # Get file info
        file_info = get_file_info(file_bytes, file.filename)

        # Check supported format
        extension = f".{file_info['extension']}"
        if extension not in DOCUMENT_CONFIG["supported_formats"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {extension}. "
                       f"Supported: {DOCUMENT_CONFIG['supported_formats']}"
            )

        # Parse document (in-memory, no disk storage)
        print(f"\nProcessing: {file.filename}")
        text = auto_detect_and_parse(
            file_bytes,
            file.filename,
            pdf_parser=DOCUMENT_CONFIG.get("pdf_parser", "pypdf2"),
            excel_combine_sheets=DOCUMENT_CONFIG.get("excel_combine_sheets", True)
        )

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the document"
            )

        print(f"✓ Extracted {len(text)} characters")

        # Clean text before chunking (remove PDF artifacts, normalize whitespace)
        text = clean_text(text)
        print(f"✓ Cleaned text: {len(text)} characters")

        # Chunk text
        chunks = chunk_text(
            text,
            chunk_size=RAG_CONFIG["chunk_size"],
            overlap=RAG_CONFIG["chunk_overlap"]
        )
        print(f"✓ Created {len(chunks)} chunks")

        # Generate embeddings (offloaded to thread pool — CPU-bound, ISSUE_004)
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(None, embedder.embed, chunks)
        print(f"✓ Generated {len(embeddings)} embeddings")

        # Prepare metadata
        document_counter["count"] += 1
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"  # collision-safe IDs (ISSUE_008)

        metadata = [{
            "filename": file.filename,
            "document_id": doc_id,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "upload_time": time.time()
        } for i in range(len(chunks))]

        # Resolve project — use provided project_id or fall back to default
        resolved_project_id = project_id or default_project_id

        # Add to vector database (offloaded to thread pool, ISSUE_004)
        await loop.run_in_executor(
            None,
            lambda: vector_db.add(embeddings, chunks, metadata, project_id=resolved_project_id)
        )
        print(f"✓ Added to vector database (project: {resolved_project_id})")

        # -----------------------------------------------------------------
        # FAQ Generation — extract Q&A pairs directly from full document text
        # -----------------------------------------------------------------
        faqs_generated = 0
        if db_conn is not None:
            try:
                full_text = "\n\n".join(chunks)  # reassemble from chunks
                faqs = generate_faqs(full_text, llm_client, source_file=file.filename)
                if faqs:
                    faqs_generated = store_faqs(
                        faqs, file.filename, db_conn,
                        project_id=resolved_project_id
                    )
                    print(f"✓ Stored {faqs_generated} FAQs for {file.filename}")
            except Exception as faq_err:
                # Non-fatal — RAG still works even if FAQ generation fails
                print(f"⚠ FAQ generation failed for {file.filename}: {faq_err}")

        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000

        # Get scoped stats (ISSUE_007)
        stats = vector_db.get_stats(project_id=resolved_project_id) \
            if hasattr(vector_db, 'get_stats') else {}

        return UploadResponse(
            status="success",
            message="Document processed successfully",
            document_id=doc_id,
            filename=file.filename,
            file_info=file_info,
            chunks_added=len(chunks),
            total_chunks=stats.get("total_vectors", 0),
            processing_time_ms=round(processing_time, 2),
            faqs_generated=faqs_generated
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.post("/query", response_model=QueryResponse)
async def query_knowledge_base(request: QueryRequest):
    """
    Query the knowledge base using FAQ-first, then RAG fallback.

    Flow:
    1. Check FAQ table (fast keyword search, no LLM)
    2. If no FAQ match → full RAG (embed → vector search → LLM)
    """
    start_time = time.time()

    try:
        # Validate query
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Normalize query for better retrieval (e.g., "3BHK" → "3 BHK")
        normalized_question = normalize_query(request.question)

        # Resolve project — global_search=True bypasses project scoping (ISSUE_021)
        if request.global_search:
            resolved_project_id = None  # searches all projects' vectors
        else:
            resolved_project_id = request.project_id or default_project_id

        # -----------------------------------------------------------------
        # RAG pipeline — embed → vector search → LLM
        # ISSUE_022: FAQ fast-path removed. All queries go through RAG so
        # answers are always generated fresh from the actual documents.
        # The FAQ table is now a DISPLAY layer only (mind map), not an answer cache.
        # -----------------------------------------------------------------

        # Check if project has any data (scoped, ISSUE_007)
        stats = vector_db.get_stats(project_id=resolved_project_id) \
            if hasattr(vector_db, 'get_stats') else {}
        if stats.get("total_vectors", 0) == 0:
            raise HTTPException(
                status_code=400,
                detail="No documents in knowledge base. Please upload documents first."
            )

        # Generate query embedding (offloaded to thread pool, ISSUE_004)
        loop = asyncio.get_running_loop()
        query_embedding = await loop.run_in_executor(None, embedder.embed, normalized_question)

        # Search vector database (offloaded to thread pool, ISSUE_004)
        results = await loop.run_in_executor(
            None,
            lambda: vector_db.search(query_embedding, top_k=request.top_k, project_id=resolved_project_id)
        )
        similarity_threshold = RAG_CONFIG.get("similarity_threshold", 0.15)
        results = [r for r in results if r[3] > similarity_threshold]

        if not results:
            return QueryResponse(
                question=request.question,
                answer="I couldn't find relevant information for your query. Please try rephrasing your question or upload related documents.",
                sources=[],
                processing_time_ms=round((time.time() - start_time) * 1000, 2),
                source_type="rag"
            )

        # Generate answer using LLM (pass original question for natural response)
        answer = generate_answer(llm_client, request.question, results)

        # ISSUE_023: Auto-save this Q&A to FAQ table (General / user_chat).
        # Uses upsert: identical questions get their answer updated, not duplicated.
        # ISSUE_025: expanded no-info guard — skip storage for all failure phrases.
        _NO_INFO_PHRASES = [
            "couldn't find", "could not find", "i don't have information",
            "i don't have that information", "no information available",
            "no relevant information", "i'm unable to find", "i cannot find",
            "not found in the", "i don't know", "no data available",
            "i have no information", "unable to answer",
        ]
        _is_failed_answer = answer and any(p in answer.lower() for p in _NO_INFO_PHRASES)
        if db_conn is not None and resolved_project_id and answer and not _is_failed_answer:
            try:
                loop2 = asyncio.get_running_loop()
                await loop2.run_in_executor(
                    None,
                    lambda: upsert_chat_faq(
                        question=request.question,
                        answer=answer,
                        conn=db_conn,
                        project_id=resolved_project_id,
                    )
                )
            except Exception as faq_save_err:
                print(f"⚠ Auto-FAQ upsert failed (non-fatal): {faq_save_err}")

        # Format sources
        sources = [{
            "text": text[:200] + "..." if len(text) > 200 else text,
            "filename": metadata.get("filename", "Unknown"),
            "chunk_index": metadata.get("chunk_index", 0),
            "similarity_score": round(score, 3)
        } for _, text, metadata, score in results]

        processing_time = (time.time() - start_time) * 1000

        return QueryResponse(
            question=request.question,
            answer=answer,
            sources=sources,
            processing_time_ms=round(processing_time, 2),
            source_type="rag"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")


@app.get("/faqs", response_model=FAQsResponse)
async def get_faqs(project_id: Optional[str] = Query(default=None)):
    """
    Get FAQ entries grouped by category for the mind map UI.
    Pass ?project_id=<uuid> to scope to a project; omit for default project.
    """
    if db_conn is None:
        return FAQsResponse(categories=[], total=0)

    resolved_project_id = project_id or default_project_id

    try:
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(
            None, lambda: get_all_faqs(db_conn, project_id=resolved_project_id)
        )

        categories = [
            FAQCategoryData(
                name=cat["name"],
                color=cat["color"],
                icon=cat["icon"],
                faqs=[
                    FAQEntry(
                        id=faq["id"],
                        question=faq["question"],
                        answer=faq["answer"],
                        category=cat["name"],
                        source_file=faq.get("source_file")
                    )
                    for faq in cat["faqs"]
                ]
            )
            for cat in data["categories"]
        ]

        return FAQsResponse(categories=categories, total=data["total"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FAQ fetch error: {str(e)}")


@app.delete("/faqs/chat")
async def clear_chat_faqs(project_id: Optional[str] = Query(default=None)):
    """
    Delete ALL user_chat FAQ entries (AI chat auto-saves) for a project.
    This clears the General category in the mind map.
    """
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")

    resolved_project_id = project_id or default_project_id

    try:
        loop = asyncio.get_running_loop()
        deleted = await loop.run_in_executor(
            None, lambda: delete_chat_faqs(db_conn, project_id=resolved_project_id)
        )
        return {"deleted": deleted, "message": f"Cleared {deleted} AI chat FAQ(s)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clear chat FAQs error: {str(e)}")


@app.delete("/faqs/{faq_id}")
async def delete_faq(faq_id: int, project_id: Optional[str] = Query(default=None)):
    """
    Delete a single FAQ entry by ID.
    Scoped to project_id when provided.
    """
    if db_conn is None:
        raise HTTPException(status_code=503, detail="Database not available")

    resolved_project_id = project_id or default_project_id

    try:
        loop = asyncio.get_running_loop()
        deleted = await loop.run_in_executor(
            None, lambda: delete_faq_by_id(faq_id, db_conn, project_id=resolved_project_id)
        )
        if not deleted:
            raise HTTPException(status_code=404, detail=f"FAQ {faq_id} not found")
        return {"deleted": True, "faq_id": faq_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete FAQ error: {str(e)}")


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """Get system status and statistics."""
    stats = vector_db.get_stats()

    return StatusResponse(
        status="running",
        total_documents=document_counter["count"],
        total_chunks=stats.get("total_vectors", 0),
        embedding_model=f"{EMBEDDING_CONFIG['provider']}/{EMBEDDING_CONFIG['model']}",
        vector_db_provider=VECTOR_DB_CONFIG["provider"],
        llm_model=f"{LLM_CONFIG['provider']}/{LLM_CONFIG['model']}"
    )


@app.delete("/reset")
async def reset_database(project_id: Optional[str] = Query(default=None)):
    """
    Reset vector database and FAQs.
    Pass ?project_id=<uuid> to clear only that project's data (ISSUE_003).
    Omit to clear all data (global reset).
    """
    if project_id:
        try:
            uuid.UUID(project_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="project_id must be a valid UUID")
    try:
        if VECTOR_DB_CONFIG["provider"] == "pgvector" and project_id:
            vector_db.reset(project_id=project_id)
        else:
            vector_db.reset()
            document_counter["count"] = 0

        return {
            "status": "success",
            "message": f"Reset complete (project={project_id or 'all'})",
            "total_documents": 0,
            "total_chunks": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset error: {str(e)}")


@app.post("/save")
async def save_database():
    """Save vector database to disk."""
    try:
        if VECTOR_DB_CONFIG["provider"] == "faiss":
            path = VECTOR_DB_CONFIG["faiss"]["persist_path"]
            vector_db.save(path)
            return {
                "status": "success",
                "message": f"Database saved to {path}",
                "path": path
            }
        elif VECTOR_DB_CONFIG["provider"] == "chromadb":
            return {
                "status": "success",
                "message": "ChromaDB auto-persists data",
                "path": VECTOR_DB_CONFIG["chromadb"]["persist_directory"]
            }
        else:
            return {
                "status": "info",
                "message": f"{VECTOR_DB_CONFIG['provider']} is cloud-based, auto-persists"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save error: {str(e)}")


@app.post("/load")
async def load_database():
    """Load vector database from disk."""
    try:
        if VECTOR_DB_CONFIG["provider"] == "faiss":
            path = VECTOR_DB_CONFIG["faiss"]["persist_path"]
            vector_db.load(path)
            stats = vector_db.get_stats()
            return {
                "status": "success",
                "message": f"Database loaded from {path}",
                "total_vectors": stats.get("total_vectors", 0)
            }
        elif VECTOR_DB_CONFIG["provider"] == "chromadb":
            return {
                "status": "success",
                "message": "ChromaDB auto-loads data on initialization"
            }
        else:
            return {
                "status": "info",
                "message": f"{VECTOR_DB_CONFIG['provider']} is cloud-based, auto-loads"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Load error: {str(e)}")


# =============================================================================
# MAIN - Run Server
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 80)
    print("Starting RAG API Server...")
    print("=" * 80)
    print(f"Host: {API_CONFIG['host']}")
    print(f"Port: {API_CONFIG['port']}")
    print(f"Docs: http://localhost:{API_CONFIG['port']}/docs")
    print("=" * 80 + "\n")

    uvicorn.run(
        "app:app",
        host=API_CONFIG["host"],
        port=API_CONFIG["port"],
        reload=API_CONFIG["reload"]
    )
