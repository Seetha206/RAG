# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SellBot RAG System -- an AI-powered real estate Sales Operating System. A modular RAG API built with FastAPI (Python 3.11+) that enables document upload (PDF, DOCX, Excel, TXT) and semantic querying. Currently in Phase 1 (RAG Core); WhatsApp/WATI integration, CRM, and analytics are planned future phases (see `knowledge_base/SELLBOT_SYSTEM_ARCHITECTURE.md`).

## Architecture

The system uses a **plugin-based design with abstract base classes and factory functions**. Swap embedding models, vector databases, or LLMs by editing `config.py` only -- no code changes needed.

**Core pipeline:**
Document upload (bytes stream) → `src/document_parsers.py` (in-memory parse) → `chunk_text()` → `src/embeddings.py` (embed) → `src/vector_databases.py` (store) → On query: `src/query_utils.py` (normalize) → embed query → vector search → `src/llm.py` (generate answer)

**Project structure:**
```
├── app.py                    # FastAPI server entry point (routes + global state init)
├── config.py                 # All provider selection and tuning parameters
├── src/                      # Core library package
│   ├── __init__.py           # Re-exports public API
│   ├── embeddings.py         # EmbeddingProvider ABC + LocalEmbeddings, OpenAIEmbeddings, CohereEmbeddings
│   ├── vector_databases.py   # VectorDatabase ABC + FAISSDatabase, ChromaDBDatabase, PineconeDatabase, PgVectorDatabase
│   ├── document_parsers.py   # Streaming parsers (PDF, DOCX, XLSX, TXT) + chunk_text() + clean_text()
│   ├── models.py             # Pydantic request/response models (QueryRequest, QueryResponse, etc.)
│   ├── llm.py                # LLM client init (create_llm_client) + generate_answer()
│   └── query_utils.py        # normalize_query() for real estate shorthand
├── scripts/                  # Utility and standalone scripts
│   ├── simple_rag.py         # End-to-end RAG demo (FAISS + Gemini, no API server)
│   ├── inspect_db.py         # Inspect vector DB contents and stats
│   ├── inspect_faiss.py      # FAISS index inspection
│   ├── pinecone_rag.py       # Pinecone integration example
│   └── generate_docs.py      # Generate test real estate documents
├── RAG/                      # React 19 + TypeScript + Vite + Tailwind frontend
├── overview/                 # Standalone React 18 informational/marketing page
├── prototype/                # Minimal vanilla HTML/CSS/JS chat UI (single index.html)
├── knowledge_base/           # All documentation, guides, and architecture docs
├── YAML/                     # Deployment and setup config files (pgvector SQL, backend/frontend YAML)
├── real_estate_documents/    # Generated test documents
├── vector_store/             # FAISS index persistence directory
├── error_logs/               # Error tracking (YAML)
├── session_logs/             # Session tracking (YAML)
└── requirements*.txt         # Python dependencies
```

**Key modules (in `src/`):**
- `embeddings.py` -- `EmbeddingProvider` ABC with `LocalEmbeddings`, `OpenAIEmbeddings`, `CohereEmbeddings`; factory: `get_embedding_provider()`
- `vector_databases.py` -- `VectorDatabase` ABC with `FAISSDatabase`, `ChromaDBDatabase`, `PineconeDatabase`, `PgVectorDatabase`; factory: `get_vector_database()`. Note: `config.py` lists `weaviate` and `qdrant` as options but they are **not yet implemented** in this file.
- `document_parsers.py` -- streaming parsers (all work on `bytes`, never touch disk); entry point: `auto_detect_and_parse()`
- `models.py` -- Pydantic models: `QueryRequest`, `QueryResponse`, `UploadResponse`, `StatusResponse`
- `llm.py` -- `create_llm_client()` factory + `generate_answer(llm_client, query, chunks)` dispatcher
- `query_utils.py` -- `normalize_query()` handles BHK, sqft, Crores, Lakhs, Rs/INR normalization

**Current default config:** local embeddings (BAAI/bge-large-en-v1.5, 1024 dims) + pgvector + Gemini (`models/gemini-3-flash-preview`).

**Global state in `app.py`:** The embedding provider, vector DB, and LLM client are initialized at module import time as module-level globals (`embedder`, `vector_db`, `llm_client`). LLM client is created via `create_llm_client()` from `src/llm.py`. The `generate_answer()` helper takes `llm_client` as an explicit parameter and dispatches to the correct LLM API based on provider.

**Three frontends exist:**
- `prototype/` -- single `index.html` vanilla HTML/CSS/JS chat UI (calls `POST /query` at localhost:8000)
- `overview/` -- standalone React 18 informational page (no TypeScript, no Redux)
- `RAG/` -- full React 19 + TypeScript + Vite + Tailwind chat app with Redux Toolkit (persisted), react-router, axios. Tests via Vitest + Testing Library + MSW.

### React Frontend Architecture (RAG/)

State management: Redux Toolkit with `redux-persist` (store in `src/store/`, slices in `src/store/slices/`). API calls via axios (`src/services/api/`). Routing via `react-router-dom` (`src/routes/`). Icons from `lucide-react`. Notifications via `react-toastify`. Chat messages rendered with `react-markdown` + `remark-gfm` + `react-syntax-highlighter`. Form validation with `zod` + `react-hook-form`. Component structure: `src/components/chat/` (chat UI), `src/components/common/` (shared), `src/components/layout/` (layout wrappers). Page-level components in `src/pages/`. Custom hooks in `src/hooks/`. Shared types in `src/types/`. Utility functions in `src/utils/`. Internationalization setup in `src/i18n/`. Shared env/config helpers in `src/functions/`. Three env files: `.env.development`, `.env.production`, `.env.testlive`.

**Test conventions:** Component tests are **co-located** next to their source files (e.g., `Button.test.tsx` beside `Button.tsx`). `src/__tests__/` is shared test infrastructure only: `setup.ts` (global jest-dom matchers) and `test-utils.tsx` (custom `render()` pre-wired with Redux Provider + MemoryRouter). Use `should + verb` for test descriptions. Import the custom `render` from `../__tests__/test-utils` for any component that needs Redux or routing context.

## Development Commands

### Python Backend
```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements_api.txt

# Run dev server (auto-reload)
uvicorn app:app --reload

# Run directly
python app.py

# Swagger UI at http://localhost:8000/docs

# Utility scripts
python scripts/simple_rag.py      # End-to-end RAG flow (FAISS + Gemini, no API server)
python scripts/inspect_db.py      # Inspect vector DB contents and stats
python scripts/generate_docs.py   # Generate test real estate documents

# Production
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Requirements files:** `requirements_api.txt` is the primary dependency file for the API server (cloud provider packages are commented out -- uncomment as needed). `requirements_production.txt` includes additional production dependencies (gunicorn, monitoring). `requirements.txt` is minimal/legacy.

### React Frontend (RAG/ directory)
```bash
cd RAG
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run lint:fix
npm run format       # Prettier
npm run test         # Vitest (watch mode)
npm run test:coverage  # Vitest with coverage
npm run test:ui      # Vitest browser UI
npm run type-check   # tsc --noEmit
```

## API Endpoints

- `POST /upload` -- stream document, parse in-memory, embed, store (PDF/DOCX/XLSX/TXT, max 50MB)
- `POST /query` -- RAG query `{question, top_k?}` returns `{answer, sources, processing_time_ms}`
- `GET /status` -- system health (document count, vector count, active providers)
- `DELETE /reset` -- clear all vectors
- `POST /save` / `POST /load` -- persist/restore FAISS index (others auto-persist)

## Adding New Providers

**Embedding:** Create class in `src/embeddings.py` inheriting `EmbeddingProvider` (implement `embed()`, `get_dimensions()`, `get_model_name()`), add to `get_embedding_provider()` factory, add config to `config.py`.

**Vector DB:** Create class in `src/vector_databases.py` inheriting `VectorDatabase` (implement `add()`, `search()`, `save()`, `load()`, `reset()`, `get_stats()`), add to `get_vector_database()` factory, add config to `config.py`.

**Document parser:** Add parser function (signature: `bytes -> str`) to `src/document_parsers.py`, register in `auto_detect_and_parse()`, update `DOCUMENT_CONFIG["supported_formats"]`.

**LLM provider:** Add a new `elif` branch in `create_llm_client()` and `generate_answer()` in `src/llm.py`, add config to `config.py` under `LLM_CONFIG`.

## Important Constraints

- **Embedding dimensions must match** between `EMBEDDING_CONFIG["dimensions"]` and the vector DB's dimension parameter. Mismatches cause runtime errors.
- **All document processing is in-memory** -- parsers accept `bytes` and return `str`. Never write uploaded files to disk.
- **Cloud provider packages are commented out** in `requirements_api.txt` -- uncomment as needed (e.g., `pinecone-client`, `openai`, `anthropic`).
- **pgvector requires** PostgreSQL with the `vector` extension installed. Table/index creation is automatic in `PgVectorDatabase._setup_database()`.
- **Similarity scoring differs by provider:** FAISS uses `1/(1+L2)`, pgvector uses `1-cosine_distance`, Pinecone returns native cosine similarity.
- **`embed()` accepts both `str` and `List[str]`**, always returns `np.ndarray`. For a single string it returns shape `(1, dims)`.
- **`search()` returns** `List[Tuple[str, str, Dict, float]]` -- each tuple is `(id, text, metadata, similarity_score)`.
- **`generate_answer()` takes `llm_client` as first argument** -- the LLM client is created once at startup via `create_llm_client()` and passed explicitly.

## Environment Variables (.env)

```bash
GEMINI_API_KEY=...                    # Required (default LLM)
PGVECTOR_CONNECTION_STRING=...        # Required if using pgvector (default vector DB)
# Optional provider keys:
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
COHERE_API_KEY=...
PINECONE_API_KEY=...
```

## RAG Tuning (config.py → RAG_CONFIG)

- `chunk_size` (default 800) -- larger = more context, less precise retrieval
- `chunk_overlap` (default 200) -- prevents splitting related info
- `top_k` (default 10) -- number of chunks retrieved per query
- `similarity_threshold` (default 0.15) -- minimum cosine similarity to include a chunk
- `system_prompt` -- grounding prompt with `{context}` and `{query}` placeholders

## Session & Error Logs

Both log systems are **manually maintained YAML files** — the app does not write to them automatically. They are the project's institutional memory: what broke, how it was fixed, and what happened in each working session.

### Error Logs (`error_logs/`)

**Naming convention:** `error_{name}_logs_{YYYYMMDD}.yml`

Each entry schema:
```yaml
errors:
  - id: ERR_001                          # Sequential, never reuse
    timestamp: "2026-02-20T23:45:00"
    category: "RAG Pipeline"             # RAG Pipeline | Vector Database | Frontend | Build | RAG Retrieval
    description: "One-line summary"
    root_cause: |
      Multi-line explanation of why it happened
    impact: "What broke for the user"
    fix_applied: "What code change resolved it"
    files_changed:                        # Optional — list files touched
      - src/document_parsers.py
    status: "resolved"                   # resolved | partially_resolved | open
    follow_up: "ERR_010"                 # Optional — links to next related error
```

**When to add an entry:** Any bug that took more than a few minutes to diagnose, or that could silently recur. Especially important for RAG quality issues (chunking, thresholds, retrieval failures) since they produce wrong answers rather than crashes.

**Key errors already logged (ERR_001–ERR_011):**
- ERR_001: Blind character chunking split sentences mid-word → rewrote `chunk_text()` with sentence-boundary splitting
- ERR_003: IVFFlat index failed on small dataset → switched to HNSW
- ERR_004: No similarity threshold → added `similarity_threshold=0.3` filter
- ERR_009/010: Query phrasing sensitivity → lowered threshold to 0.15, added `normalize_query()`, raised `top_k` to 10
- ERR_011: Upload button misaligned in flex layout → moved disclaimer out of InputBox

### Session Logs (`session_logs/`)

**Naming convention:** `session_{name}_logs.yml` (single file, append each session)

Each entry schema:
```yaml
sessions:
  - session_id: SESSION_001              # Sequential
    date: "2026-02-20"
    duration: "~3 hours"
    summary: "One-line description of what the session accomplished"

    activities:
      - order: 1
        timestamp: "2026-02-20T21:00:00"
        action: "Short action label"
        description: |
          What was done in detail
        files_changed:                    # Optional
          - CLAUDE.md
        outcome: "Result"                 # Optional
```

**When to add an entry:** At the end of each meaningful working session. Captures what was built, what decisions were made, and what files changed — so future sessions (and future Claude instances) can understand the project's evolution without reading every commit.

## Documentation

All docs live in `knowledge_base/`:
- `knowledge_base/SELLBOT_SYSTEM_ARCHITECTURE.md` -- full system architecture doc
- `knowledge_base/API_DOCUMENTATION.md` -- full API reference
- `knowledge_base/PGVECTOR_SETUP.md` -- PostgreSQL + pgvector installation
- `knowledge_base/PRODUCTION_DEPLOYMENT.md` -- deployment guide
- `knowledge_base/CLAUDE_EXTENDED.md` -- extended Claude Code guide with config switching examples
- `knowledge_base/EMBEDDING_MODELS.md` -- embedding model comparison and selection
- `knowledge_base/RAG_DEEP_DIVE.md` -- conceptual RAG guide
- `knowledge_base/TECHNICAL_DEEP_DIVE.md` -- architecture deep dive
- `knowledge_base/chunks_explained.md` -- how document chunking works
- `knowledge_base/similarity_percentage_explained.md` -- what match scores mean
- `knowledge_base/similarity_threshold_explained.md` -- threshold tuning guide
- `knowledge_base/prompt_engineering.md` -- system prompt design and tuning
- `knowledge_base/semantic_questions.md` -- 40 test questions for RAG system
- `knowledge_base/backend_retrieval_fixes.md` -- all pipeline fix documentation
- `knowledge_base/QUICK_START.md` -- quick start guide for new developers
- `knowledge_base/NEW_SETUP_GUIDE.md` -- updated setup instructions
- `knowledge_base/VECTOR_DB.md` -- vector database comparison and selection
- `knowledge_base/HNSW_vs_IVFFlat.md` -- HNSW vs IVFFlat index tradeoffs
- `knowledge_base/RAG_IMPLEMENTATION_ALTERNATIVES.md` -- alternative implementation approaches
- `knowledge_base/CODE_EXPLANATION.md` -- line-by-line code walkthrough
- `knowledge_base/GEMINI.md` -- Gemini API usage notes
- `knowledge_base/CHECKING_DATABASE.md` -- how to inspect and verify pgvector data
