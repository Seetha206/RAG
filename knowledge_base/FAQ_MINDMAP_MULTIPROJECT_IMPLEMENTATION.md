# FAQ Mind Map + Multi-Project Implementation — Full Documentation

> Status: **Complete** (all 5 phases implemented)
> Implemented: 2026-03-01
> Sessions: SESSION_002, SESSION_003

---

## What Was Built

Two major features were implemented back-to-back in this session:

1. **FAQ Mind Map UI** — Transformed the RAG React frontend from a sidebar-chat layout into an interactive SVG mind map where uploaded documents auto-generate FAQ trees (Root → Category → Questions).
2. **Multi-Project Architecture** — Extended the single-tenant RAG backend into a full multi-project, multi-client system where each project gets isolated vector storage and FAQ data.

---

## Part 1 — FAQ Mind Map UI (Frontend Transformation)

### What Changed

The existing `RAG/` React app had a sidebar + chat layout. It was fully replaced with a Kimi-style interactive FAQ mind map.

### New Frontend Files

#### `RAG/src/types/faq.types.ts`
TypeScript interfaces mirroring the backend FAQ Pydantic models:
```typescript
export interface FAQEntry {
  id: number;
  question: string;
  answer: string;
  category: string;
  source_file?: string;
}
export interface FAQCategoryData {
  name: string;
  color: string;
  icon: string;
  faqs: FAQEntry[];
}
export interface FAQsResponse {
  categories: FAQCategoryData[];
  total: number;
}
```

#### `RAG/src/store/slices/faqSlice.ts`
Redux Toolkit slice for FAQ state:
- State: `{ categories, total, isLoading, error }`
- Actions: `setFAQs`, `setFAQLoading`, `setFAQError`
- Selectors use local `StateWithFAQ` type (NOT `RootState`) to avoid circular import
- Persisted via `redux-persist` (in `store/index.ts` whitelist)

**Critical note — circular import fix:** `@types/faq.types` alias triggers TypeScript TS6137 when used with `import type`. All type imports in `faqSlice.ts` use relative paths (`../../types/faq.types`) and `import type { PayloadAction } from '@reduxjs/toolkit'` (type-only import) to satisfy `verbatimModuleSyntax`.

#### `RAG/src/services/api/faqService.ts`
```typescript
export const getFAQs = () => apiClient.get<FAQsResponse>(RAG_URLS.FAQS);
```

#### `RAG/src/components/mindmap/MindMapView.tsx`
Main mind map component. Key features:
- **SVG layout constants**: `ROOT_X=90`, `CAT_X=340`, `Q_X=660`, `SVG_WIDTH=1050`
- **`buildLayout()`**: Calculates node positions dynamically based on expanded categories and FAQ counts
- **`bezierPath()`**: Generates cubic bezier SVG paths connecting nodes
- **Toolbar**: Search input (real-time filtering), refresh button, file upload input, AI chat toggle
- **Root node**: Blue pill "SellBot AI" on the left
- **Category nodes**: Colored circles with +/- expand toggle, category label
- **Question nodes**: Small circle + truncated question text (≤35 chars)
- **AI Chat panel**: Slides in from right, calls `postQuery()` from `ragService.ts`, shows `source_type="faq"` badge when FAQ-matched
- **Upload flow**: Calls `postUpload()`, refreshes FAQ tree on success via `loadFAQs()`
- **`loadFAQs`**: Wrapped in `useCallback([dispatch])` to satisfy ESLint `exhaustive-deps`

#### `RAG/src/components/mindmap/FAQAnswerModal.tsx`
Animated modal (framer-motion) for displaying a clicked FAQ answer:
- Backdrop blur overlay, closes on click
- Category badge (colored pill)
- Question as heading, answer as body text
- Source file attribution in footer

### Modified Frontend Files

| File | Change |
|---|---|
| `RAG/src/App.tsx` | Replaced sidebar+chat layout with Header + `<MindMapView />` |
| `RAG/src/store/index.ts` | Added `faqReducer` to `combineReducers`, added `'faq'` to persist whitelist |
| `RAG/src/services/api/urls.ts` | Added `FAQS: '/faqs'` to `RAG_URLS` |
| `RAG/src/types/rag.types.ts` | Added `source_type?: string` to `QueryResponse`, `faqs_generated?: number` to `UploadResponse` |

### Dependency Added
```bash
cd RAG && npm install framer-motion
```

### Fixed Categories (Frontend + Backend)

| Category | Color | Icon (lucide) |
|---|---|---|
| Pricing | `#3b82f6` | DollarSign |
| Amenities | `#8b5cf6` | Sparkles |
| Location | `#14b8a6` | MapPin |
| Process | `#f59e0b` | ClipboardList |
| Specifications | `#ec4899` | Ruler |
| Security | `#ef4444` | Shield |
| General | `#6b7280` | Info |

---

## Part 2 — Backend FAQ Pipeline

### New Backend Files

#### `src/faq_db.py`
All PostgreSQL operations for the `faq_entries` table. Functions:

| Function | Signature | Purpose |
|---|---|---|
| `setup_faq_table` | `(conn)` | CREATE TABLE + indexes (idempotent) |
| `store_faqs` | `(faqs, source_file, conn, project_id=None)` | Bulk INSERT, skips exact duplicates |
| `get_all_faqs` | `(conn, project_id=None)` | SELECT all, grouped by category |
| `search_faq` | `(question, conn, project_id=None)` | Full-text search via `ts_rank` |
| `delete_faqs_by_file` | `(source_file, conn, project_id=None)` | DELETE by source file |

**Table schema:**
```sql
CREATE TABLE faq_entries (
    id          SERIAL PRIMARY KEY,
    project_id  UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    category    VARCHAR(100) NOT NULL DEFAULT 'General',
    source_file VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_faq_category   ON faq_entries(category);
CREATE INDEX idx_faq_project_id ON faq_entries(project_id);
CREATE INDEX idx_faq_fts        ON faq_entries USING GIN (to_tsvector('english', question));
```

#### `src/faq_generator.py`
LLM-direct FAQ extraction (bypasses RAG pipeline — sends full document text directly to LLM):
- `FIXED_CATEGORIES`: 7 predefined category strings
- `MAX_TEXT_CHARS = 50_000`: Truncates text to fit LLM context window
- `FAQ_PROMPT`: Structured prompt that forces JSON array output with `{question, answer, category}`
- `generate_faqs(text, llm_client, source_file, max_faqs=25)`: Dispatches to correct LLM provider (Ollama/Gemini/OpenAI/Claude), parses JSON (handles markdown fences), validates category against FIXED_CATEGORIES (defaults to "General" if invalid)

---

## Part 3 — Multi-Project Architecture (5 Phases)

### Phase 1 — DB Schema + Migration

#### `scripts/migrate_multiproject.py` (NEW)
One-time migration script. Idempotent (safe to re-run):
1. Creates `projects` table
2. Inserts "Default Project" (vdb_namespace = 'default')
3. Adds `project_id UUID FK` to `rag_documents` → assigns existing rows to Default Project
4. Adds `project_id UUID FK` to `faq_entries` → assigns existing rows to Default Project
5. Creates all indexes

**Run once:**
```bash
cd /path/to/RAG
python scripts/migrate_multiproject.py
```

#### `projects` Table Schema
```sql
CREATE TABLE projects (
    project_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(255) NOT NULL,
    vdb_namespace VARCHAR(255) NOT NULL UNIQUE,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
```

#### Full DB Schema After Migration
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
│  project_id UUID FK │ │  project_id  UUID FK        │
│  embedding vector   │ │  question    TEXT            │
│  text     TEXT      │ │  answer      TEXT            │
│  metadata JSONB     │ │  category    VARCHAR(100)    │
│  created_at         │ │  source_file VARCHAR(255)    │
└─────────────────────┘ └────────────────────────────┘
```

### Phase 2 — Project Management API

#### `src/project_manager.py` (NEW)

| Function | Purpose |
|---|---|
| `create_project(name, conn)` | INSERT into projects, return dict |
| `list_projects(conn)` | SELECT all projects |
| `get_project(project_id, conn)` | SELECT by UUID or None |
| `delete_project(project_id, conn)` | DELETE (CASCADE removes all data) |
| `get_or_create_default_project(conn)` | Ensures Default Project exists, returns UUID string |

#### New API Endpoints (in `app.py`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/projects` | Create project → returns `{project_id, project_name, vdb_namespace}` |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{project_id}` | Get one project |
| `DELETE` | `/projects/{project_id}` | Delete project + all data (CASCADE) |

**Protection:** Cannot delete the Default Project (returns HTTP 400).

#### New Pydantic Models (in `src/models.py`)
```python
class ProjectCreate(BaseModel):
    project_name: str

class ProjectResponse(BaseModel):
    project_id: str
    project_name: str
    vdb_namespace: str
    created_at: Optional[str] = None

class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
```

### Phase 3 — Multi-tenant Upload + Query

#### Upload (`POST /upload`)
Accepts optional `project_id` form field:
```
POST /upload
Content-Type: multipart/form-data
  file: <binary>
  project_id: <uuid>   ← optional, defaults to Default Project
```

#### Query (`POST /query`)
`project_id` field added to `QueryRequest`:
```json
{
  "question": "What is the price?",
  "top_k": 10,
  "project_id": "uuid-here"   ← optional
}
```

#### FAQs (`GET /faqs`)
```
GET /faqs?project_id=<uuid>   ← optional
```
Omitting `project_id` returns FAQs for the Default Project.

#### `src/vector_databases.py` — PgVectorDatabase updates
- `_setup_database()`: Creates `projects` table first (FK dependency), adds `project_id UUID` to `rag_documents`
- `add(embeddings, texts, metadata, project_id=None)`: Inserts with `project_id::uuid`
- `search(query_embedding, top_k, project_id=None)`: Adds `WHERE project_id = %s::uuid` when provided

### Phase 4 — FAQ Auto-generation on Upload
Already implemented via `src/faq_generator.py`. Now scoped:
- After `vector_db.add()`, calls `generate_faqs()` → `store_faqs(..., project_id=resolved_project_id)`
- Non-fatal: if FAQ generation fails, upload still succeeds

### Phase 5 — FAQ-first Query Flow
Already implemented. Now scoped:
- Before RAG, calls `search_faq(question, db_conn, project_id=resolved_project_id)`
- Full-text `ts_rank` search filtered by `project_id`
- On match: returns `source_type="faq"` immediately (no LLM call)
- On miss: falls through to project-scoped vector search + LLM

---

## Complete File Change Summary

### New Files

| File | Purpose |
|---|---|
| `src/faq_db.py` | FAQ table CRUD (project-scoped) |
| `src/faq_generator.py` | LLM-direct FAQ extraction |
| `src/project_manager.py` | Project CRUD |
| `scripts/migrate_multiproject.py` | One-time DB migration |
| `RAG/src/types/faq.types.ts` | Frontend FAQ type definitions |
| `RAG/src/store/slices/faqSlice.ts` | Redux FAQ slice |
| `RAG/src/services/api/faqService.ts` | `GET /faqs` API call |
| `RAG/src/components/mindmap/MindMapView.tsx` | Main mind map component |
| `RAG/src/components/mindmap/FAQAnswerModal.tsx` | FAQ answer modal |

### Modified Files

| File | What Changed |
|---|---|
| `app.py` | Project endpoints, `project_id` wired through upload/query/faqs, startup creates Default Project |
| `src/models.py` | Added `ProjectCreate`, `ProjectResponse`, `ProjectListResponse`; `QueryRequest` gets `project_id`; `QueryResponse` gets `source_type`; `UploadResponse` gets `faqs_generated` |
| `src/vector_databases.py` | `PgVectorDatabase._setup_database` creates `projects` table + adds `project_id` to `rag_documents`; `add()` and `search()` accept `project_id` |
| `RAG/src/App.tsx` | New layout: Header + `<MindMapView />` (removed sidebar+ChatWindow) |
| `RAG/src/store/index.ts` | Added `faqReducer`, `'faq'` to persist whitelist |
| `RAG/src/services/api/urls.ts` | Added `FAQS: '/faqs'` |
| `RAG/src/types/rag.types.ts` | `QueryResponse` + `source_type?`; `UploadResponse` + `faqs_generated?` |
| `knowledge_base/MULTI_PROJECT_RAG_PLAN.md` | Status updated to complete |

---

## How to Run

### First-time setup (existing DB)
```bash
# 1. Run migration to add project_id columns
python scripts/migrate_multiproject.py

# 2. Start backend
uvicorn app:app --reload

# 3. Start frontend
cd RAG && npm run dev
```

### New installation
```bash
# Just start — migration is automatic via _setup_database() + setup_faq_table()
uvicorn app:app --reload
cd RAG && npm run dev
```

### Typical API workflow
```bash
# Create a project
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Sunrise Heights"}'
# → {"project_id": "abc-123-...", "project_name": "Sunrise Heights", ...}

# Upload a document scoped to the project
curl -X POST http://localhost:8000/upload \
  -F "file=@Sunrise_Heights.pdf" \
  -F "project_id=abc-123-..."

# Query scoped to the project (FAQ-first, then RAG)
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price?", "project_id": "abc-123-..."}'

# Get FAQ mind map data
curl http://localhost:8000/faqs?project_id=abc-123-...
```

---

## Known Bugs Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| White blank page | `faqSlice.ts` imported `RootState` from `@store/index` which imports `faqSlice` → circular dependency at Vite runtime | Replaced `RootState` type with local `StateWithFAQ = { faq: FAQState }` |
| `PayloadAction` not found | Vite ESM: `PayloadAction` is a type; importing it as value failed | Changed to `import type { PayloadAction } from '@reduxjs/toolkit'` |
| TS6137 on `@types/faq.types` | TypeScript reserves `@types/*` namespace for DefinitelyTyped; path alias conflicts | Used relative import `../../types/faq.types` in `faqSlice.ts` |

---

## Architecture Decision Log

| Decision | Choice | Reason |
|---|---|---|
| Project isolation strategy | Single table + `project_id` UUID FK filter | pgvector supports WHERE clause natively; no separate tables per project |
| FAQ match strategy | PostgreSQL `ts_rank` full-text search (GIN index) | Fast, no embedding cost, no LLM call on FAQ hit |
| FAQ generation timing | Synchronous on upload | Simple for Phase 1; can move to background task (FastAPI BackgroundTasks) if needed |
| Default project | Always created at startup via `get_or_create_default_project()` | Ensures old single-tenant data is always accessible |
| `project_id` in requests | Optional everywhere (defaults to Default Project) | Backward compatible — existing frontend calls work without changes |
| Cannot delete Default Project | HTTP 400 guard in DELETE `/projects/{id}` | Protects all existing/unscoped data |
| `@types/` alias in slices | Relative path import used instead | TypeScript's DefinitelyTyped namespace conflicts with the path alias when used with `import type` |

---

## Part 4 — Backend Production Hardening (2026-03-04)

> Sessions: SESSION_005

### Issues Fixed from Production Audit

Full issue list tracked in `issue-fix/multi_project_production_issues.yml`.

#### `config.py` — API security config from env (ISSUE_002)
```python
API_CONFIG = {
    "cors_origins": os.getenv("CORS_ORIGINS", "*").split(","),
    "api_key": os.getenv("API_KEY"),  # None → auth disabled
}
```

#### `src/vector_databases.py` — Thread-safe connection pool (ISSUE_001, 003, 004, 005, 007)
- Replaced single `self.conn` for all ops with `psycopg2.pool.ThreadedConnectionPool`
- `_get_conn()` / `_put_conn()`: acquire/release per-call with `autocommit=True`
- `add()`, `search()`, `reset()`, `get_stats()`: each use pool connection in `try/finally`
- `self.conn` kept for `_setup_database()` and `faq_db`/`project_manager` on the asyncio main thread
- `reset(project_id=None)`: if project_id given, deletes from both `rag_documents` AND `faq_entries`; otherwise clears all rows from both (ISSUE_003)
- `get_stats(project_id=None)`: scoped `COUNT(*)` (ISSUE_007)
- `_setup_database()`: now creates `idx_{table_name}_project_id` B-tree index (ISSUE_005)

#### `app.py` — Multiple production fixes
- **`APIKeyMiddleware`** (ISSUE_002): `BaseHTTPMiddleware` checks `X-API-Key` header; exempt: `/`, `/docs`, `/openapi.json`, `/redoc`; only active when `API_CONFIG["api_key"]` is set
- **Startup guard** (ISSUE_017): `RuntimeError` if pgvector configured but `default_project_id` is None
- **UUID validation** on `/upload` (ISSUE_006): `uuid.UUID(project_id)` before processing
- **`run_in_executor`** for embed+add in `/upload`, embed+search in `/query` (ISSUE_004)
- **Scoped stats** (ISSUE_007): `vector_db.get_stats(project_id=resolved_project_id)`
- **Collision-safe doc IDs** (ISSUE_008): `f"doc_{uuid.uuid4().hex[:12]}"`
- **`/reset`** (ISSUE_003): `?project_id=<uuid>` query param; UUID validated; calls `vector_db.reset(project_id=project_id)`

#### `src/faq_db.py` — Bulk insert (ISSUE_010)
Replaced N+1 SELECT+INSERT loop in `store_faqs()`:
1. One `SELECT ... WHERE question = ANY(%s)` to find existing duplicates
2. Python-side dedup filter
3. One `execute_values()` bulk INSERT

#### `src/models.py` — Input validation (ISSUE_006, 014, 015)
- `QueryRequest.project_id`: `@field_validator` with `_validate_uuid()` helper
- `QueryRequest.top_k`: `Field(ge=1, le=50)`
- `ProjectCreate.project_name`: `Field(min_length=1, max_length=255)`

---

## Part 5 — Dark Theme Redesign + Dashboard Navigation (2026-03-04)

> Sessions: SESSION_005, SESSION_006

### Design System

Replaced light sidebar+chat theme with a dark glass UI. Color palette (Midnight Rose):

| Token | Value | Usage |
|---|---|---|
| `brand.primary` | `#fb7185` | Buttons, active nodes, chat header gradient start |
| `brand.secondary` | `#94a3b8` | Icons, text highlights, gradient end |
| `brand.glow` | `#1e293b` | Cursor radial gradient spread |
| `brand.dark` | `#0f172a` | Base background |

**Key CSS classes:**
- `.glass-card`: `rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)` + `border: 1px solid rgba(255,255,255,0.1)`
- `.gradient-cursor`: fixed 600×600px radial-gradient (rose → slate → transparent) following mouse via `mousemove` listener

### Dashboard + Routing

**New routes:**
- `/` → `DashboardPage`
- `/projects/:projectId` → `MindMapView` (scoped to that project)
- `*` → fallback to `DashboardPage`

#### `RAG/src/pages/DashboardPage.tsx` (NEW)
- Fetches `GET /projects` on mount; handles loading / error / empty / grid states
- Grid of project cards: cycling color accent bar, folder icon, name, namespace, created date
- "+ New Project" dashed card at end of grid
- New Project modal: creates via `POST /projects`, immediately navigates to mind map
- Error state (backend unreachable): friendly message + retry
- Empty state: CTA to create first project

#### `RAG/src/components/mindmap/MindMapView.tsx` — Props-based refactor
**Before:** managed own project list, selector dropdown, New Project modal.
**After:** accepts `{ projectId: string; onBack: () => void }` props.
- Removed: `projects` state, `selectedProjectId`, `showNewProject`, `loadProjects`, `handleCreateProject`
- Added: `← Projects` back button in toolbar
- On `projectId` change: immediately dispatches `setFAQs({ categories: [], total: 0 })` before loading new project's FAQs
- `handleUpload` and `handleSend` use `projectId` prop directly

#### `RAG/src/store/index.ts`
Removed `'faq'` from `redux-persist` whitelist — FAQ state fetched fresh on every project view; no stale data across sessions or when backend is offline.

### Backend Fixes for Dashboard

| File | Fix |
|---|---|
| `src/project_manager.py` | `list_projects()` adds `WHERE vdb_namespace != 'default'` — Default Project hidden from Dashboard |
| `app.py` | All project CRUD endpoints + `GET /faqs` wrap blocking psycopg2 calls in `run_in_executor` |
| `src/faq_db.py` | `get_all_faqs()` uses `WHERE project_id = %s::uuid` (explicit cast) |

---

## Updated File Change Summary (2026-03-04 additions)

| File | Change |
|---|---|
| `config.py` | `cors_origins` and `api_key` read from env |
| `src/vector_databases.py` | ThreadedConnectionPool; pool-based methods; project_id B-tree index |
| `src/faq_db.py` | Bulk INSERT in store_faqs; `::uuid` cast in get_all_faqs |
| `src/models.py` | UUID validator, Field constraints on top_k and project_name |
| `src/project_manager.py` | list_projects filters Default Project |
| `app.py` | APIKeyMiddleware, startup guard, run_in_executor everywhere, scoped stats, UUID validation |
| `RAG/tailwind.config.js` | Brand color tokens (primary/secondary/glow/dark) |
| `RAG/src/index.css` | Full dark theme rewrite (glass-card, gradient-cursor, dark prose/scrollbar) |
| `RAG/src/index.html` | Added weight 300 to Inter Google Fonts URL |
| `RAG/src/store/index.ts` | Removed `faq` from persist whitelist |
| `RAG/src/main.tsx` | Added `<BrowserRouter>` |
| `RAG/src/routes/routeNames.ts` | `DASHBOARD` + `PROJECT_MINDMAP` routes |
| `RAG/src/App.tsx` | Routes/Route structure; cursor glow useEffect; dark header; "Knowledge Base" label |
| `RAG/src/pages/DashboardPage.tsx` | NEW — project cards grid, New Project modal, routing |
| `RAG/src/components/mindmap/MindMapView.tsx` | Props-based projectId/onBack; back button; dark theme; removed project management UI |
| `RAG/src/components/mindmap/FAQAnswerModal.tsx` | Dark glass-card modal styling |
