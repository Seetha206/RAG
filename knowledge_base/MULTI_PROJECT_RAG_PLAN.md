# Multi-Project RAG — Implementation Plan

> Based on: `multi_project_rag_architecture_diagram.md`
> Status: Planning
> Last updated: 2026-02-26

---

## Overview

Transform the current single-tenant SellBot RAG into a **multi-project, multi-client system** where:
- Each project (client/property portfolio) has its own isolated vector space
- Each project auto-generates a FAQ database from uploaded PDFs
- Queries check FAQ first (fast, no embedding cost), fall back to full RAG only if needed

---

## Phase Roadmap

```
Phase 1 → DB Schema + Migration          ← START HERE
Phase 2 → Project Management API
Phase 3 → Multi-tenant Upload + Query
Phase 4 → FAQ Auto-generation on Upload
Phase 5 → FAQ-first Query Flow
```

---

## Phase 1 — DB Schema (Current Focus)

### 1.1 New Tables Required

#### `projects` table (MAIN DB — PostgreSQL)

```sql
CREATE TABLE projects (
    project_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(255) NOT NULL,
    vdb_namespace VARCHAR(255) NOT NULL UNIQUE,  -- matches project_id for pgvector
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
```

> `vdb_namespace` = the value stored in `project_id` column of `rag_documents`
> For pgvector: same DB, filtered by project_id (not separate tables)

---

#### `rag_documents` table — ADD `project_id` column (MIGRATION)

```sql
-- Existing table (auto-created by PgVectorDatabase._setup_database())
-- Current schema:
--   id TEXT, content TEXT, metadata JSONB, embedding vector(1024)

-- Migration: add project_id column
ALTER TABLE rag_documents
    ADD COLUMN project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE;

-- Index for fast project-scoped search
CREATE INDEX idx_rag_documents_project_id ON rag_documents(project_id);
```

> Existing rows will have `project_id = NULL` — assign to a "default" project in migration script.

---

#### `faq_entries` table (NEW — SQL, not vector)

```sql
CREATE TABLE faq_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    source      VARCHAR(50) DEFAULT 'pdf_generated',  -- 'pdf_generated' | 'manual'
    source_file VARCHAR(255),                          -- original filename
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Index for project-scoped FAQ lookup
CREATE INDEX idx_faq_entries_project_id ON faq_entries(project_id);

-- Full-text search index (for keyword matching in query flow)
CREATE INDEX idx_faq_entries_question_fts
    ON faq_entries
    USING GIN (to_tsvector('english', question));
```

---

### 1.2 Full Schema Diagram

```
┌─────────────────────────────────────┐
│             projects                │
│─────────────────────────────────────│
│ project_id    UUID  PK              │
│ project_name  VARCHAR(255) NOT NULL │
│ vdb_namespace VARCHAR(255) UNIQUE   │
│ created_at    TIMESTAMP             │
│ updated_at    TIMESTAMP             │
└──────────────┬──────────────────────┘
               │ 1
               │
       ────────┼────────
       │                │
       │ N              │ N
┌──────▼──────────────┐ ┌──────▼──────────────────┐
│    rag_documents    │ │       faq_entries        │
│─────────────────────│ │──────────────────────────│
│ id       TEXT  PK   │ │ id          UUID  PK     │
│ project_id UUID  FK │ │ project_id  UUID  FK     │
│ content   TEXT      │ │ question    TEXT          │
│ metadata  JSONB     │ │ answer      TEXT          │
│ embedding vector    │ │ source      VARCHAR(50)   │
│           (1024)    │ │ source_file VARCHAR(255)  │
│                     │ │ created_at  TIMESTAMP     │
└─────────────────────┘ └──────────────────────────┘
```

---

### 1.3 Migration Strategy

**Step 1:** Create `projects` table
**Step 2:** Insert a "default" project for existing data
```sql
INSERT INTO projects (project_name, vdb_namespace)
VALUES ('Default Project', 'default')
RETURNING project_id;
```
**Step 3:** Add `project_id` column to `rag_documents`, set existing rows to default project_id
**Step 4:** Create `faq_entries` table
**Step 5:** Create all indexes

> Migration will be a standalone script: `scripts/migrate_multiproject.py`

---

### 1.4 pgvector Query Change (after migration)

```python
# Before (current):
SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
FROM rag_documents
ORDER BY embedding <=> $1
LIMIT $2;

# After (multi-project):
SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
FROM rag_documents
WHERE project_id = $3
ORDER BY embedding <=> $1
LIMIT $2;
```

---

## Phase 2 — Project Management API

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/projects` | Create a new project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/{project_id}` | Get project details |
| `DELETE` | `/projects/{project_id}` | Delete project + all data |

### New Module: `src/project_manager.py`
- `create_project(name)` → inserts into `projects`, returns project_id
- `list_projects()` → returns all projects
- `get_project(project_id)` → returns project or 404
- `delete_project(project_id)` → cascades to `rag_documents` + `faq_entries`

---

## Phase 3 — Multi-tenant Upload + Query

### API Changes

| Old Endpoint | New Endpoint |
|---|---|
| `POST /upload` | `POST /projects/{project_id}/upload` |
| `POST /query` | `POST /projects/{project_id}/query` |
| `GET /status` | `GET /projects/{project_id}/status` |
| `DELETE /reset` | `DELETE /projects/{project_id}/reset` |

> Old endpoints can remain as aliases pointing to the "default" project for backward compatibility.

### Core Change in `src/vector_databases.py`
- `add(texts, embeddings, metadatas)` → `add(texts, embeddings, metadatas, project_id)`
- `search(query_embedding, top_k)` → `search(query_embedding, top_k, project_id)`

---

## Phase 4 — FAQ Auto-generation on Upload

### Trigger
When `POST /projects/{project_id}/upload` completes → background task fires FAQ generation.

### Flow
```
PDF text extracted
      │
      ▼
Truncate to LLM context limit (~50k chars)
      │
      ▼
Send to LLM with FAQ prompt:
  "Generate 40 FAQ question-answer pairs in JSON format..."
      │
      ▼
Parse JSON response → List[{question, answer}]
      │
      ▼
Bulk insert into faq_entries (project_id, question, answer, source='pdf_generated', source_file)
```

### New Module: `src/faq_generator.py`
- `generate_faqs(text, llm_client, max_faqs=40)` → `List[dict]`
- `store_faqs(project_id, faqs, source_file, db_conn)` → inserts into `faq_entries`

### LLM Prompt (FAQ generation)
```
You are a real estate FAQ generator.
Given the following document text, generate {max_faqs} question-answer pairs
that cover the key information a buyer or agent would want to know.

Return ONLY a valid JSON array in this exact format:
[
  {"question": "...", "answer": "..."},
  ...
]

Document text:
{text}
```

---

## Phase 5 — FAQ-first Query Flow

### New Query Flow
```
POST /projects/{project_id}/query
      │
      ▼
Step 1: PostgreSQL full-text search on faq_entries
        WHERE project_id = ? AND to_tsvector('english', question) @@ plainto_tsquery(?)
      │
      ├── Match found (score above threshold) → return FAQ answer directly
      │
      └── No match
              │
              ▼
        Step 2: embed question
              │
              ▼
        Step 3: pgvector similarity search (WHERE project_id = ?)
              │
              ▼
        Step 4: send chunks to LLM → generate answer
              │
              ▼
          Final Answer
```

### New Module: `src/faq_search.py`
- `search_faq(project_id, question, db_conn, threshold=0.3)` → `Optional[str]`
- Uses PostgreSQL `ts_rank` for keyword scoring
- Returns answer string if match found, `None` if not

---

## Files to Create / Modify

### New files
```
src/project_manager.py         # Project CRUD
src/faq_generator.py           # LLM FAQ generation + DB storage
src/faq_search.py              # FAQ keyword lookup
scripts/migrate_multiproject.py # One-time DB migration script
```

### Modified files
```
app.py                         # New project-scoped routes
src/vector_databases.py        # add project_id param to add() and search()
src/models.py                  # New Pydantic models: ProjectCreate, ProjectResponse, FAQEntry
config.py                      # No changes needed (schema change only)
```

---

## Decision Log

| Decision | Choice | Reason |
|---|---|---|
| VDB isolation strategy | Single table + project_id filter | pgvector supports this natively; no separate tables needed |
| FAQ match strategy | PostgreSQL full-text search (GIN index) | Fast, no embedding cost, built into existing DB |
| FAQ generation timing | Background task (async, post-upload) | Upload should not block waiting for LLM to generate 40 FAQs |
| Backward compatibility | Keep old endpoints as aliases to default project | Existing prototype/UI keeps working |
| Migration approach | ALTER TABLE + default project | Non-destructive; existing data preserved |

---

## Current Status

- [x] Architecture analyzed
- [x] Plan documented
- [x] Phase 1: Schema SQL written
- [x] Phase 1: Migration script created (`scripts/migrate_multiproject.py`)
- [x] Phase 2: Project management API (`src/project_manager.py` + `/projects` endpoints)
- [x] Phase 3: Multi-tenant upload/query (project_id in upload form + query body + /faqs param)
- [x] Phase 4: FAQ auto-generation (`src/faq_generator.py`, triggered on upload, project-scoped)
- [x] Phase 5: FAQ-first query flow (`src/faq_db.search_faq`, project-scoped)

> Full implementation details: `knowledge_base/FAQ_MINDMAP_MULTIPROJECT_IMPLEMENTATION.md`
> Completed: 2026-03-01 (SESSION_002 + SESSION_003)
