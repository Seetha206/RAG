# SellBot AI — RAG System v2.1.0

AI-powered real estate Sales Operating System. A modular RAG API (FastAPI + pgvector) with multi-project (multi-tenant) support, FAQ auto-generation, and an interactive SVG mind map React frontend.

---

## Architecture

**Query pipeline (FAQ-first, then RAG fallback):**
```
Question → normalize_query() → PostgreSQL FTS (ts_rank, GIN index)
  → FAQ match?  YES → return answer  (source_type="faq")
  → NO → embed query → pgvector HNSW search → LLM → return answer  (source_type="rag")
```

**Upload pipeline:**
```
File (bytes) → document_parsers.py → chunk_text() → embeddings.py → vector_db.add() → faq_generator.py (LLM-direct FAQ extraction)
```

**Plugin-based design:** Swap embedding models, vector DBs, or LLMs by editing `config.py` only.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Backend** | FastAPI | Python 3.11+, async endpoints |
| **Embeddings** | BAAI/bge-large-en-v1.5 | Local ONNX via fastembed, 1024 dims |
| **Vector DB** | pgvector (PostgreSQL) | HNSW index, cosine similarity |
| **LLM** | Ollama sam860/LFM2:1.2b | Local default; Gemini Flash = cloud fallback |
| **Frontend** | React 19 + TypeScript | Vite 7, Tailwind v3, Redux Toolkit, SVG mind map |

---

## Quick Start

### Backend

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements_api.txt

# Ollama (required for default local LLM)
ollama serve
ollama pull sam860/LFM2:1.2b

# Configure
cp .env.example .env
# Edit .env → set PGVECTOR_CONNECTION_STRING
# (add GEMINI_API_KEY only if switching to cloud LLM)

# Run
uvicorn app:app --reload
# API docs → http://localhost:8000/docs
```

### Frontend (React mind map)

```bash
cd RAG
npm install
npm run dev
# Opens → http://localhost:3000
```

### First-time DB migration (existing installations only)

```bash
python scripts/migrate_multiproject.py
```

### Production

```bash
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## API Endpoints

### Projects (multi-tenant)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Create project → `{project_id, project_name, vdb_namespace}` |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{id}` | Get single project |
| `DELETE` | `/projects/{id}` | Delete project + all data (Default Project protected) |

### Documents & Query
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload document (PDF/DOCX/XLSX/TXT, max 50MB) + auto-generate FAQs |
| `POST` | `/query` | FAQ-first then RAG query `{question, top_k?, project_id?}` |
| `GET` | `/status` | System health — document count, vector count, active providers |

### FAQs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/faqs` | FAQ entries grouped by category `?project_id=<uuid>` |
| `DELETE` | `/faqs/chat` | Clear all AI-chat FAQs for a project |
| `DELETE` | `/faqs/{faq_id}` | Delete a single FAQ entry |

### Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| `DELETE` | `/reset` | Clear all vectors |
| `POST` | `/save` / `POST /load` | Persist/restore FAISS index (FAISS only) |

---

## Project Structure

```
├── app.py                    # FastAPI entry point — routes + global state
├── config.py                 # All provider selection and tuning parameters
├── src/
│   ├── embeddings.py         # EmbeddingProvider ABC → Local, OpenAI, Cohere
│   ├── vector_databases.py   # VectorDatabase ABC → pgvector, FAISS, ChromaDB, Pinecone
│   ├── document_parsers.py   # In-memory parsers (PDF, DOCX, XLSX, TXT) + chunk_text()
│   ├── models.py             # Pydantic models (Query, Upload, FAQ, Project)
│   ├── llm.py                # LLM client factory + generate_answer()
│   ├── query_utils.py        # normalize_query() — BHK, sqft, Crores, Lakhs
│   ├── faq_db.py             # FAQ CRUD — store, search (ts_rank), upsert_chat_faq,
│   │                         #   delete_faq_by_id, delete_chat_faqs, get_all_faqs
│   ├── faq_generator.py      # LLM-direct FAQ extraction (non-fatal, 7 categories)
│   └── project_manager.py    # Project CRUD + get_or_create_default_project()
│
├── RAG/                      # React 19 + TypeScript frontend
│   └── src/
│       ├── App.tsx           # BrowserRouter routes + gradient cursor header
│       ├── components/mindmap/
│       │   ├── MindMapView.tsx    # SVG mind map (ROOT_X=90, CAT_X=300, SVG_WIDTH=600)
│       │   └── FAQAnswerModal.tsx # framer-motion FAQ answer overlay
│       ├── pages/DashboardPage.tsx  # Project cards + global AI chat
│       ├── store/slices/faqSlice.ts # FAQ Redux slice (not persisted)
│       ├── services/api/
│       │   ├── ragService.ts    # postQuery, postUpload, getStatus
│       │   ├── faqService.ts    # getFAQs, deleteFAQ, clearChatFAQs
│       │   └── projectService.ts # Project CRUD API calls
│       └── types/
│           ├── rag.types.ts    # QueryRequest/Response + source_type, project_id
│           └── faq.types.ts    # FAQEntry, FAQCategoryData, FAQsResponse
│
├── scripts/
│   ├── migrate_multiproject.py  # One-time DB migration (idempotent)
│   ├── generate_project_docs.py # Generate test docs for 10 RE projects
│   ├── simple_rag.py            # End-to-end demo (FAISS + Gemini, no API)
│   └── inspect_db.py            # Inspect vector DB contents
│
├── knowledge_base/           # All documentation and guides
├── YAML/                     # System reference docs (backend v2.1, frontend v2.1, structure)
├── real_estate_documents/    # 10 test project folders (brochure, price list, FAQ, etc.)
├── error_logs/               # Error tracking (YAML, manually maintained)
├── session_logs/             # Session activity logs (YAML, manually maintained)
├── requirements_api.txt      # Primary dependencies
└── CLAUDE.md                 # Claude Code project instructions
```

---

## Database Schema

```
projects          →  project_id (UUID PK), project_name, vdb_namespace
rag_documents     →  id, project_id (FK), embedding vector(1024), text, metadata
faq_entries       →  id (SERIAL PK), project_id (FK), question, answer, category,
                      source_file  ('user_chat' = AI chat sourced)
```

Default Project (`vdb_namespace='default'`) is created at startup and cannot be deleted.

---

## Key Concepts

### General Category Rule
The `General` category in the mind map shows **only AI-chat sourced FAQs** (`source_file='user_chat'`). Document FAQs that the LLM classified as General are excluded.

### FAQ Upsert (no duplicates)
When the same question is asked in AI chat, the existing answer is updated — a new row is never created (ILIKE case-insensitive match).

### No-Info Guard
If the LLM returns a "no information" answer (12 phrases checked), it is **not** stored in the FAQ table.

### Multi-file Upload
The frontend supports selecting multiple files and uploads them sequentially (one at a time) to avoid LLM rate limits.

---

## Environment Variables

```bash
# Required
PGVECTOR_CONNECTION_STRING=postgresql://user:pass@localhost:5432/dbname

# Cloud LLM (only needed if switching away from Ollama)
GEMINI_API_KEY=...        # Confirmed working fallback
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
COHERE_API_KEY=...
PINECONE_API_KEY=...
```

---

## Frontend Commands

```bash
cd RAG
npm run dev           # Vite dev server (localhost:3000)
npm run build         # tsc -b && vite build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm run test          # Vitest watch mode
npm run test:coverage
```

---

## Documentation

| Doc | Location |
|-----|----------|
| Claude Code Guide | `CLAUDE.md` |
| System Architecture | `knowledge_base/SELLBOT_SYSTEM_ARCHITECTURE.md` |
| FAQ + Mind Map Implementation | `knowledge_base/FAQ_MINDMAP_MULTIPROJECT_IMPLEMENTATION.md` |
| Multi-Project Plan | `knowledge_base/MULTI_PROJECT_RAG_PLAN.md` |
| Backend Reference v2.1 | `YAML/RAG_backend_v2.yml` |
| Frontend Reference v2.1 | `YAML/RAG_frontend_v2.yml` |
| Project Structure | `YAML/RAG_project_structure.yml` |
| pgvector Setup | `knowledge_base/PGVECTOR_SETUP.md` |
| LLM Options | `knowledge_base/LLM_OPTIONS.md` |
| API Reference | `knowledge_base/API_DOCUMENTATION.md` |
| Error Logs | `error_logs/` |
| Session Logs | `session_logs/session_seetha_logs.yml` |

---

Built with FastAPI · pgvector · fastembed (BAAI/bge-large-en-v1.5) · Ollama · React 19 · TypeScript · Tailwind v3
