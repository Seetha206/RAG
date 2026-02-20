"""
FastAPI RAG Server with Streaming Document Upload and Query.
No disk storage - all documents processed in-memory!

Run with: uvicorn app:app --reload
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time

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
from src.models import QueryRequest, QueryResponse, UploadResponse, StatusResponse
from src.llm import create_llm_client, generate_answer
from src.query_utils import normalize_query

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

# =============================================================================
# GLOBAL STATE - Vector Store, Embeddings, and LLM
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

# Document counter
document_counter = {"count": 0}

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
            "POST /upload": "Upload and process documents (PDF, DOCX, Excel)",
            "POST /query": "Query the knowledge base",
            "GET /status": "Get system status",
            "DELETE /reset": "Reset vector database",
            "POST /save": "Save vector database to disk",
            "POST /load": "Load vector database from disk"
        }
    }


@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and process document (streaming, in-memory).

    Supported formats: PDF, DOCX, XLSX, TXT
    Max size: 50 MB (configurable in config.py)
    """
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

        # Generate embeddings
        embeddings = embedder.embed(chunks)
        print(f"✓ Generated {len(embeddings)} embeddings")

        # Prepare metadata
        document_counter["count"] += 1
        doc_id = f"doc_{document_counter['count']}_{int(time.time())}"

        metadata = [{
            "filename": file.filename,
            "document_id": doc_id,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "upload_time": time.time()
        } for i in range(len(chunks))]

        # Add to vector database
        vector_db.add(embeddings, chunks, metadata)
        print(f"✓ Added to vector database")

        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000

        # Get current stats
        stats = vector_db.get_stats()

        return UploadResponse(
            status="success",
            message="Document processed successfully",
            document_id=doc_id,
            filename=file.filename,
            file_info=file_info,
            chunks_added=len(chunks),
            total_chunks=stats.get("total_vectors", 0),
            processing_time_ms=round(processing_time, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.post("/query", response_model=QueryResponse)
async def query_knowledge_base(request: QueryRequest):
    """
    Query the knowledge base using RAG.

    Args:
        request: Query request with question and optional top_k

    Returns:
        Answer with source citations
    """
    start_time = time.time()

    try:
        # Validate query
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Check if vector DB has data
        stats = vector_db.get_stats()
        if stats.get("total_vectors", 0) == 0:
            raise HTTPException(
                status_code=400,
                detail="No documents in knowledge base. Please upload documents first."
            )

        # Normalize query for better retrieval (e.g., "3BHK" → "3 BHK")
        normalized_question = normalize_query(request.question)

        # Generate query embedding
        query_embedding = embedder.embed(normalized_question)

        # Search vector database and filter by similarity threshold
        results = vector_db.search(query_embedding, top_k=request.top_k)
        similarity_threshold = RAG_CONFIG.get("similarity_threshold", 0.15)
        results = [r for r in results if r[3] > similarity_threshold]

        if not results:
            return QueryResponse(
                question=request.question,
                answer="I couldn't find relevant information for your query. Please try rephrasing your question or upload related documents.",
                sources=[],
                processing_time_ms=round((time.time() - start_time) * 1000, 2)
            )

        # Generate answer using LLM (pass original question for natural response)
        answer = generate_answer(llm_client, request.question, results)

        # Format sources
        sources = [{
            "text": text[:200] + "..." if len(text) > 200 else text,
            "filename": metadata.get("filename", "Unknown"),
            "chunk_index": metadata.get("chunk_index", 0),
            "similarity_score": round(score, 3)
        } for _, text, metadata, score in results]

        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000

        return QueryResponse(
            question=request.question,
            answer=answer,
            sources=sources,
            processing_time_ms=round(processing_time, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")


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
async def reset_database():
    """Reset vector database (clear all documents)."""
    try:
        vector_db.reset()
        document_counter["count"] = 0

        return {
            "status": "success",
            "message": "Vector database reset successfully",
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
