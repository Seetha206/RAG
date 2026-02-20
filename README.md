# SellBot RAG System — AI-Powered Real Estate Sales OS

A modular Retrieval Augmented Generation (RAG) API built with FastAPI (Python 3.11+) that enables document upload (PDF, DOCX, Excel, TXT) and semantic querying for real estate sales operations.

---

## Architecture

```
User Query
  |
  v
[Query Normalization] --> [Embed Query (BAAI/bge-large, 1024d)]
  |
  v
[pgvector HNSW Cosine Search (top_k=10)]
  |
  v
[Similarity Threshold Filter (>0.15)]
  |
  v
[Gemini Flash LLM generates answer with context]
  |
  v
Response + Source Citations (with % match scores)
```

**Plugin-based design:** Swap embedding models, vector databases, or LLMs by editing `config.py` only — no code changes needed.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Backend** | FastAPI | Python 3.11+, async endpoints |
| **Embeddings** | BAAI/bge-large-en-v1.5 | Local, 1024 dimensions |
| **Vector DB** | pgvector (PostgreSQL) | HNSW index, cosine similarity |
| **LLM** | Google Gemini Flash | 1M token context window |
| **Frontend** | React 19 + TypeScript | Vite 7, Tailwind CSS, Redux Toolkit |

---

## Quick Start

### Backend

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements_api.txt

# Configure
cp .env.example .env
# Edit .env → add GEMINI_API_KEY and PGVECTOR_CONNECTION_STRING

# Run
uvicorn app:app --reload
# API docs → http://localhost:8000/docs
```

### Frontend (React)

```bash
cd RAG
npm install
npm run dev
# Opens → http://localhost:3000
```

### Production

```bash
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload document (PDF/DOCX/XLSX/TXT, max 50MB) — parsed in-memory, chunked, embedded, stored |
| `POST` | `/query` | RAG query `{question, top_k?}` → `{answer, sources, processing_time_ms}` |
| `GET` | `/status` | System health — document count, vector count, active providers |
| `DELETE` | `/reset` | Clear all vectors from database |
| `POST` | `/save` | Persist FAISS index to disk (FAISS only) |
| `POST` | `/load` | Restore FAISS index from disk (FAISS only) |

---

## Project Structure

```
├── app.py                        # FastAPI server — routes + global state init
├── config.py                     # All provider selection and tuning parameters
├── .env                          # API keys (GEMINI_API_KEY, PGVECTOR_CONNECTION_STRING)
│
├── src/                          # Core library package
│   ├── __init__.py               # Re-exports public API
│   ├── embeddings.py             # EmbeddingProvider ABC → Local, OpenAI, Cohere
│   ├── vector_databases.py       # VectorDatabase ABC → FAISS, ChromaDB, Pinecone, pgvector
│   ├── document_parsers.py       # Streaming parsers (PDF, DOCX, XLSX, TXT) + chunk_text + clean_text
│   ├── models.py                 # Pydantic request/response models
│   ├── llm.py                    # LLM client factory + generate_answer()
│   └── query_utils.py            # normalize_query() for real estate shorthand
│
├── scripts/                      # Utility and standalone scripts
│   ├── simple_rag.py             # End-to-end RAG demo (FAISS + Gemini, no API server)
│   ├── inspect_db.py             # Inspect vector DB contents and stats
│   ├── inspect_faiss.py          # FAISS index inspection
│   ├── pinecone_rag.py           # Pinecone integration example
│   └── generate_docs.py          # Generate test real estate documents
│
├── RAG/                          # React 19 + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx               # Layout with header, sidebar, chat window
│   │   ├── components/
│   │   │   └── chat/
│   │   │       ├── ChatWindow.tsx    # Main chat — hero state, messages, FAQ cards
│   │   │       ├── InputBox.tsx      # Query bar with search icon
│   │   │       ├── MessageBubble.tsx # User/assistant messages with markdown + sources
│   │   │       ├── Sidebar.tsx       # Conversation list
│   │   │       └── UploadButton.tsx  # File upload (icon + prominent variants)
│   │   ├── store/slices/
│   │   │   └── chatSlice.ts      # Redux state — conversations, messages, loading
│   │   ├── services/api/
│   │   │   └── ragService.ts     # API calls — postQuery, postUpload, getStatus
│   │   └── types/
│   │       ├── chat.types.ts     # Message, Conversation types
│   │       └── rag.types.ts      # QueryRequest, QueryResponse, Source types
│   └── package.json
│
├── frontend/                     # Minimal vanilla HTML/CSS/JS chat UI (legacy)
│
├── knowledge_base/               # All documentation and learning resources
│   ├── SELLBOT_SYSTEM_ARCHITECTURE.md # Full system architecture doc
│   ├── API_DOCUMENTATION.md          # Complete API reference
│   ├── PGVECTOR_SETUP.md             # PostgreSQL + pgvector setup guide
│   ├── PRODUCTION_DEPLOYMENT.md      # Production deployment guide
│   ├── EMBEDDING_MODELS.md           # Embedding model comparison
│   ├── RAG_DEEP_DIVE.md              # Conceptual RAG guide
│   ├── TECHNICAL_DEEP_DIVE.md        # Architecture deep dive
│   ├── CODE_EXPLANATION.md            # Code walkthrough
│   ├── QUICK_START.md                 # Quick start guide
│   ├── NEW_SETUP_GUIDE.md            # Step-by-step setup
│   ├── chunks_explained.md           # How document chunking works
│   ├── similarity_percentage_explained.md  # What match % scores mean
│   ├── similarity_threshold_explained.md   # Threshold tuning guide
│   ├── prompt_engineering.md         # System prompt design and tuning
│   ├── semantic_questions.md         # 40 test questions for RAG system
│   └── backend_retrieval_fixes.md    # All pipeline fix documentation
│
├── real_estate_documents/        # 14 test documents (10 PDF, 2 XLSX, 2 DOCX)
├── error_logs/                   # Error tracking (YAML)
├── session_logs/                 # Session activity logs (YAML)
│
├── requirements_api.txt          # Primary dependencies
├── requirements_production.txt   # Production dependencies (gunicorn, monitoring)
├── CLAUDE.md                     # Claude Code instructions
└── README.md                     # This file
```

---

## RAG Pipeline Details

### Document Upload Flow
```
File (bytes) → validate_file_size() → auto_detect_and_parse() → clean_text() → chunk_text() → embed() → vector_db.add()
```

### Query Flow
```
Question → normalize_query() → embed() → vector_db.search(top_k=10) → filter(score > 0.15) → generate_answer(LLM) → response
```

### Key Configuration (config.py)

```python
RAG_CONFIG = {
    "chunk_size": 800,              # Characters per chunk (sentence-boundary aware)
    "chunk_overlap": 200,           # Overlap between chunks
    "top_k": 10,                    # Chunks retrieved per query
    "similarity_threshold": 0.15,   # Minimum cosine similarity
}
```

### Query Normalization
The system automatically normalizes common real estate shorthand before embedding:
- `3BHK` → `3 BHK`
- `1200sqft` → `1200 sq.ft.`
- `1.5cr` → `1.5 Crores`
- `50L` → `50 Lakhs`
- `INR` → `Rs.`

---

## Adding New Providers

### New Embedding Provider
1. Create class in `src/embeddings.py` inheriting `EmbeddingProvider`
2. Implement `embed()`, `get_dimensions()`, `get_model_name()`
3. Add to `get_embedding_provider()` factory
4. Add config to `config.py`

### New Vector Database
1. Create class in `src/vector_databases.py` inheriting `VectorDatabase`
2. Implement `add()`, `search()`, `save()`, `load()`, `reset()`, `get_stats()`
3. Add to `get_vector_database()` factory
4. Add config to `config.py`

### New Document Parser
1. Add parser function (`bytes → str`) to `src/document_parsers.py`
2. Register in `auto_detect_and_parse()`
3. Update `DOCUMENT_CONFIG["supported_formats"]`

### New LLM Provider
1. Add `elif` branch in `create_llm_client()` and `generate_answer()` in `src/llm.py`
2. Add config to `config.py` under `LLM_CONFIG`

---

## Environment Variables (.env)

```bash
# Required
GEMINI_API_KEY=...
PGVECTOR_CONNECTION_STRING=postgresql://user:pass@localhost:5432/rag_db

# Optional (uncomment providers as needed)
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
# COHERE_API_KEY=...
# PINECONE_API_KEY=...
```

---

## Frontend Commands

```bash
cd RAG
npm run dev          # Vite dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:coverage
npm run type-check   # tsc --noEmit
```

---

## Testing

```bash
# Utility scripts
python scripts/simple_rag.py      # End-to-end RAG flow
python scripts/inspect_db.py      # Inspect vector DB contents
python scripts/generate_docs.py   # Generate test documents

# API health
curl http://localhost:8000/status

# Frontend tests
cd RAG && npm run test
```

---

## Documentation

| Doc | Location |
|-----|----------|
| Claude Code Guide | `CLAUDE.md` |
| System Architecture | `knowledge_base/SELLBOT_SYSTEM_ARCHITECTURE.md` |
| API Reference | `knowledge_base/API_DOCUMENTATION.md` |
| pgvector Setup | `knowledge_base/PGVECTOR_SETUP.md` |
| Production Deployment | `knowledge_base/PRODUCTION_DEPLOYMENT.md` |
| Embedding Models | `knowledge_base/EMBEDDING_MODELS.md` |
| RAG Deep Dive | `knowledge_base/RAG_DEEP_DIVE.md` |
| Technical Deep Dive | `knowledge_base/TECHNICAL_DEEP_DIVE.md` |
| Quick Start | `knowledge_base/QUICK_START.md` |
| Chunks Explained | `knowledge_base/chunks_explained.md` |
| Similarity % Explained | `knowledge_base/similarity_percentage_explained.md` |
| Threshold Tuning Guide | `knowledge_base/similarity_threshold_explained.md` |
| Prompt Engineering | `knowledge_base/prompt_engineering.md` |
| Semantic Test Questions | `knowledge_base/semantic_questions.md` |
| Backend Fixes Log | `knowledge_base/backend_retrieval_fixes.md` |
| Error Logs | `error_logs/error_seetha_logs_*.yml` |
| Session Logs | `session_logs/session_seetha_logs.yml` |

---

Built with FastAPI, pgvector, BAAI/bge-large-en-v1.5, Gemini Flash, React 19, and TypeScript.
