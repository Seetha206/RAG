# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SellBot RAG System -- an AI-powered real estate Sales Operating System. A modular RAG API built with FastAPI (Python 3.11+) with multi-project (multi-tenant) support, FAQ auto-generation, and an interactive SVG mind map frontend. WhatsApp/WATI integration, CRM, and analytics are planned future phases (see `knowledge_base/SELLBOT_SYSTEM_ARCHITECTURE.md`).

## Architecture

The system uses a **plugin-based design with abstract base classes and factory functions**. Swap embedding models, vector databases, or LLMs by editing `config.py` only -- no code changes needed.

**Query pipeline (FAQ-first, then RAG fallback):**
1. `normalize_query()` → full-text PostgreSQL FAQ search (`ts_rank` via `src/faq_db.py`) → if match, return immediately with `source_type="faq"`
2. If no FAQ match → embed query → `vector_db.search()` (project-scoped) → `generate_answer()` → return with `source_type="rag"`

**Upload pipeline:**
Document upload (bytes stream) → `src/document_parsers.py` (in-memory parse) → `chunk_text()` → `src/embeddings.py` (embed) → `src/vector_databases.py` (store, project-scoped) → `src/faq_generator.py` (LLM-direct FAQ extraction, non-fatal)

**Project structure:**
```
├── app.py                    # FastAPI server entry point (routes + global state init)
├── config.py                 # All provider selection and tuning parameters
├── src/                      # Core library package
│   ├── __init__.py           # Re-exports public API
│   ├── embeddings.py         # EmbeddingProvider ABC + LocalEmbeddings, OpenAIEmbeddings, CohereEmbeddings
│   ├── vector_databases.py   # VectorDatabase ABC + FAISSDatabase, ChromaDBDatabase, PineconeDatabase, PgVectorDatabase
│   ├── document_parsers.py   # Streaming parsers (PDF, DOCX, XLSX, TXT) + chunk_text() + clean_text()
│   ├── models.py             # Pydantic models (QueryRequest/Response, UploadResponse, StatusResponse, FAQ*, Project*)
│   ├── llm.py                # LLM client init (create_llm_client) + generate_answer()
│   ├── query_utils.py        # normalize_query() for real estate shorthand
│   ├── faq_db.py             # FAQ table CRUD: setup_faq_table, store_faqs, get_all_faqs, search_faq, delete_faqs_by_file
│   ├── faq_generator.py      # LLM-direct FAQ extraction: generate_faqs() — bypasses RAG, sends full text to LLM
│   └── project_manager.py    # Project CRUD: create_project, list_projects, get_project, delete_project, get_or_create_default_project
├── scripts/
│   ├── migrate_multiproject.py  # One-time DB migration (idempotent): adds project_id columns + Default Project
│   ├── simple_rag.py            # End-to-end RAG demo (FAISS + Gemini, no API server)
│   ├── inspect_db.py            # Inspect vector DB contents and stats
│   ├── inspect_faiss.py         # FAISS index inspection
│   ├── pinecone_rag.py          # Pinecone integration example
│   └── generate_docs.py         # Generate test real estate documents
├── RAG/                      # React 19 + TypeScript + Vite + Tailwind v3 frontend (mind map UI)
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
- `models.py` -- Pydantic models: `QueryRequest` (+ `project_id`), `QueryResponse` (+ `source_type`), `UploadResponse` (+ `faqs_generated`), `StatusResponse`, `FAQEntry`, `FAQCategoryData`, `FAQsResponse`, `ProjectCreate`, `ProjectResponse`, `ProjectListResponse`
- `llm.py` -- `create_llm_client()` factory + `generate_answer(llm_client, query, chunks)` dispatcher
- `query_utils.py` -- `normalize_query()` handles BHK, sqft, Crores, Lakhs, Rs/INR normalization
- `faq_db.py` -- all PostgreSQL ops for `faq_entries` table; `search_faq()` uses `ts_rank` with GIN index; FAQ match threshold: `rank > 0.01`
- `faq_generator.py` -- `generate_faqs(text, llm_client, source_file, max_faqs=25)`; truncates to 50,000 chars; returns validated `{question, answer, category}` list; 7 fixed categories (Pricing, Amenities, Location, Process, Specifications, Security, General)
- `project_manager.py` -- CRUD for the `projects` table; `get_or_create_default_project()` is called at startup to guarantee a fallback

**Current default config:** fastembed/ONNX embeddings (BAAI/bge-large-en-v1.5, 1024 dims) + pgvector + Ollama (`sam860/LFM2:1.2b`). Fastembed model cached at `~/.cache/fastembed/` after first run. Gemini (`gemini-2.5-flash`) is the confirmed cloud fallback — swap by uncommenting in `config.py`.

**Global state in `app.py`:** Five module-level globals initialized at startup: `embedder`, `vector_db`, `llm_client`, `db_conn` (psycopg2 connection reused from `vector_db.conn`), `default_project_id` (UUID string). `db_conn` and `default_project_id` are `None` when provider is not pgvector. FAQ features silently degrade when `db_conn is None`.

## Database Schema (pgvector)

```
┌──────────────────────────────────────┐
│              projects                │
│  project_id   UUID  PK               │
│  project_name VARCHAR(255)           │
│  vdb_namespace VARCHAR(255) UNIQUE   │
│  created_at   TIMESTAMP             │
└──────────┬─────────────┬─────────────┘
           │ 1           │ 1
           │ N           │ N
┌──────────▼──────────┐ ┌▼──────────────────────────┐
│   rag_documents     │ │       faq_entries          │
│  id       TEXT  PK  │ │  id          SERIAL PK     │
│  project_id UUID FK │ │  project_id  UUID FK       │
│  embedding vector   │ │  question    TEXT (GIN FTS) │
│  text     TEXT      │ │  answer      TEXT          │
│  metadata JSONB     │ │  category    VARCHAR(100)  │
│  created_at         │ │  source_file VARCHAR(255)  │
└─────────────────────┘ └────────────────────────────┘
```

**Default Project** (vdb_namespace = `'default'`) is created at startup. It cannot be deleted (HTTP 400 guard). All uploads/queries without `project_id` fall back to the Default Project.

**First-time migration (existing DB only):** `python scripts/migrate_multiproject.py` — idempotent. New installations auto-setup via `PgVectorDatabase._setup_database()` + `setup_faq_table()`.

## Development Commands

### Python Backend
```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements_api.txt

# Ollama setup (required when LLM_CONFIG provider = "ollama")
ollama serve                       # Must be running before starting API server
ollama pull sam860/LFM2:1.2b      # Pull the configured model
# Alternative local models: ollama pull mistral | ollama pull llama3.1

# Run dev server (auto-reload)
uvicorn app:app --reload

# Run directly
python app.py

# Swagger UI at http://localhost:8000/docs

# One-time DB migration for existing installations
python scripts/migrate_multiproject.py

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
npm run dev           # Vite dev server on http://localhost:3000
npm run build         # tsc -b && vite build
npm run preview       # Preview production build locally
npm run lint          # ESLint
npm run lint:fix
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run test          # Vitest (watch mode)
npm run test:coverage # Vitest with coverage
npm run test:ui       # Vitest browser UI
npm run type-check    # tsc --noEmit
```

## API Endpoints

- `POST /projects` -- create project → `{project_id, project_name, vdb_namespace}`
- `GET /projects` -- list all projects
- `GET /projects/{project_id}` -- get one project
- `DELETE /projects/{project_id}` -- delete project + all data (CASCADE); Default Project is protected
- `POST /upload` -- stream document, parse in-memory, embed, store, auto-generate FAQs (PDF/DOCX/XLSX/TXT, max 50MB). Optional form field: `project_id`
- `POST /query` -- FAQ-first then RAG query `{question, top_k?, project_id?}` returns `{answer, sources, processing_time_ms, source_type}`
- `GET /faqs` -- FAQ entries grouped by category `?project_id=<uuid>` (optional)
- `GET /status` -- system health (document count, vector count, active providers)
- `DELETE /reset` -- clear all vectors
- `POST /save` / `POST /load` -- persist/restore FAISS index only; no-ops for other providers

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
- **Ollama client is a plain dict** (`{"type": "ollama", "base_url": "..."}`) -- not an SDK object. `generate_answer()` detects `LLM_CONFIG["provider"]` directly, so `llm_client` type varies by provider. `httpx` is used for Ollama HTTP calls (ensure it is installed: `pip install httpx`).
- **Groq provider** is documented in `knowledge_base/LLM_OPTIONS.md` but **not yet implemented** in `src/llm.py` -- requires a new `elif` branch in both `create_llm_client()` and `generate_answer()`.
- **FAQ generation is synchronous on upload** -- non-fatal (upload succeeds even if FAQ generation fails). Can be moved to `FastAPI BackgroundTasks` if needed.

## React Frontend Architecture (RAG/)

The RAG frontend is a **Kimi-style interactive SVG mind map** (not a sidebar+chat layout). Entry point is a Dashboard with project cards; clicking a project navigates to the mind map view where FAQ trees auto-generate (Root → Category → Questions). The AI chat panel slides in from the right and shows a `source_type="faq"` badge on FAQ-matched answers.

**Dark theme:** Midnight Rose palette — Primary `#fb7185` (rose-400), Secondary `#94a3b8` (slate-400), Background `#1e293b` (slate-800), Darkest `#0f172a` (slate-900). Design tokens defined in `tailwind.config.js` as `brand.*` extensions. `.glass-card` utility: `rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)` + `border: 1px solid rgba(255,255,255,0.1)`. `.gradient-cursor`: fixed 600×600px radial-gradient div tracking mouse via `mousemove` listener in `index.html`.

**Routing:** `BrowserRouter` (added in `main.tsx`) with two routes in `src/routes/routeNames.ts`:
- `ROUTES.DASHBOARD = '/'` → `DashboardPage`
- `ROUTES.PROJECT_MINDMAP(projectId) = '/projects/:projectId'` → `MindMapRoute` (inner component in `App.tsx` that reads `useParams` and passes `projectId` to `MindMapView`)

State management: Redux Toolkit with `redux-persist` (store in `src/store/`, slices in `src/store/slices/`). **`faq` slice is NOT in the persist whitelist** — FAQ state always starts empty and is fetched on demand. API calls via axios (`src/services/api/`). Icons from `lucide-react`. Notifications via `react-toastify`. Chat messages rendered with `react-markdown` + `remark-gfm` + `react-syntax-highlighter`. Form validation with `zod` + `react-hook-form`. Animations via `framer-motion` (FAQ answer modal, dashboard card stagger). Component structure: `src/components/chat/`, `src/components/common/`, `src/components/layout/`, `src/components/mindmap/`. Page-level components in `src/pages/`. Custom hooks in `src/hooks/`. Shared types in `src/types/`. Utility functions in `src/utils/`. Internationalization setup in `src/i18n/`. Shared env/config helpers in `src/functions/` (`static_variable.ts` is the single source of truth for env config values). Three env files: `.env.development`, `.env.production`, `.env.testlive`.

**Key frontend files:**
- `src/pages/DashboardPage.tsx` -- project cards grid; CARD_COLORS cycles 7 accent colours; loading/error/empty states; "+ New Project" modal (calls `projectService.createProject`, navigates to mind map); `formatDate()` via `Intl.DateTimeFormat`; framer-motion stagger + `whileHover y:-4`
- `src/components/mindmap/MindMapView.tsx` -- accepts `{ projectId: string; onBack: () => void }` props (not self-managing); SVG layout: `ROOT_X=90`, `CAT_X=340`, `Q_X=660`, `SVG_WIDTH=1050`; `← Projects` back button; `useEffect([projectId])` immediately clears FAQ state then calls `loadFAQs()`; calls `GET /faqs` via `faqService.ts`, `POST /upload` and `POST /query` via `ragService.ts`
- `src/components/mindmap/FAQAnswerModal.tsx` -- framer-motion animated modal for FAQ answers
- `src/store/slices/faqSlice.ts` -- Redux slice for `{ categories, total, isLoading, error }` (not persisted)
- `src/services/api/faqService.ts` -- `getFAQs()` calling `GET /faqs`
- `src/services/api/projectService.ts` -- project management API calls
- `src/types/faq.types.ts` -- TypeScript interfaces: `FAQEntry`, `FAQCategoryData`, `FAQsResponse`

**Path aliases (13, defined in `vite.config.ts`):** `@` → `src/`, `@components`, `@pages`, `@store`, `@services`, `@utils`, `@hooks`, `@types`, `@styles`, `@assets`, `@routes`, `@i18n`, `@functions`. Always use these for imports -- never relative `../../` chains.

**Critical frontend gotchas:**
- **`@types/*` alias conflict:** TypeScript reserves the `@types/` namespace for DefinitelyTyped. In `faqSlice.ts`, use relative import `../../types/faq.types` — NOT the `@types/faq.types` alias — to avoid TS6137.
- **Circular import in faqSlice:** Do NOT import `RootState` from `@store/index` in `faqSlice.ts` — it causes a circular dependency at Vite runtime (white blank page). Use a local `StateWithFAQ = { faq: FAQState }` type instead.
- **`PayloadAction` import:** Must use `import type { PayloadAction } from '@reduxjs/toolkit'` (type-only) to satisfy `verbatimModuleSyntax`.

**Test conventions:** Component tests are **co-located** next to their source files (e.g., `Button.test.tsx` beside `Button.tsx`). `src/__tests__/` is shared test infrastructure only: `setup.ts` (global jest-dom matchers) and `test-utils.tsx` (custom `render()` pre-wired with Redux Provider + MemoryRouter). Use `should + verb` for test descriptions. Import the custom `render` from `../__tests__/test-utils` for any component that needs Redux or routing context. MSW v2 (`msw` in devDependencies) is available for mocking API requests in integration tests.

## Environment Variables (.env)

```bash
PGVECTOR_CONNECTION_STRING=...        # Required (default vector DB)
# LLM keys — only needed for the active cloud provider:
GEMINI_API_KEY=...                    # Required if provider = "gemini" (confirmed working fallback)
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
COHERE_API_KEY=...
PINECONE_API_KEY=...
# No key needed when provider = "ollama" (local, uses http://localhost:11434)
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

**Key errors already logged (ERR_001–ERR_015):**
- ERR_001: Blind character chunking split sentences mid-word → rewrote `chunk_text()` with sentence-boundary splitting
- ERR_003: IVFFlat index failed on small dataset → switched to HNSW
- ERR_004: No similarity threshold → added `similarity_threshold=0.3` filter
- ERR_009/010: Query phrasing sensitivity → lowered threshold to 0.15, added `normalize_query()`, raised `top_k` to 10
- ERR_011: Upload button misaligned in flex layout → moved disclaimer out of InputBox
- ERR_012: Leaked Gemini API key revoked by Google → new key from aistudio.google.com
- ERR_013: Gemini queries timing out (ECONNABORTED) + 429 on deprecated model → switched to gemini-2.5-flash, raised axios timeout to 60s
- ERR_014: Blocking psycopg2 calls in async endpoints + Default Project leaking into Dashboard + missing `::uuid` cast in `get_all_faqs` → `run_in_executor`, `WHERE vdb_namespace != 'default'`, explicit UUID cast
- ERR_015: Stale FAQ data shown on frontend-only run → removed `faq` from redux-persist whitelist

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

All docs live in `knowledge_base/`. Key references:
- `SELLBOT_SYSTEM_ARCHITECTURE.md` -- full system architecture and future phases
- `FAQ_MINDMAP_MULTIPROJECT_IMPLEMENTATION.md` -- complete implementation docs for multi-project + FAQ mind map (all 5 phases, file change summary, known bugs, architecture decisions)
- `CLAUDE_EXTENDED.md` -- extended Claude Code guide with provider-switching examples
- `PGVECTOR_SETUP.md` -- PostgreSQL + pgvector installation
- `NEW_SETUP_GUIDE.md` -- updated setup instructions for new developers
- `backend_retrieval_fixes.md` -- all RAG pipeline fix history
- `CHECKING_DATABASE.md` -- how to inspect and verify pgvector data
- `LLM_OPTIONS.md` -- LLM alternatives to Gemini (Groq, Ollama, OpenAI) with decision guide; Groq is flagged as the best free cloud alternative (LPU hardware, generous free tier, OpenAI-compatible API)
- `MULTI_PROJECT_RAG_PLAN.md` -- original 5-phase implementation plan (status: complete as of 2026-03-01)
