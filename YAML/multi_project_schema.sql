-- =============================================================================
-- Multi-Project RAG Schema
-- Run order: Step 1 → Step 2 → Step 3 → Step 4 → Step 5
-- Safe to run on existing DB: uses IF NOT EXISTS + IF EXISTS guards
-- =============================================================================

-- Prerequisites
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()


-- =============================================================================
-- STEP 1: Create projects table (MAIN registry)
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    project_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name  VARCHAR(255) NOT NULL,
    vdb_namespace VARCHAR(255) NOT NULL UNIQUE,  -- used as project_id filter in rag_documents
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- STEP 2: Insert default project (for existing rag_documents rows)
-- =============================================================================

INSERT INTO projects (project_name, vdb_namespace)
VALUES ('Default Project', 'default')
ON CONFLICT (vdb_namespace) DO NOTHING;


-- =============================================================================
-- STEP 3: Migrate rag_documents — add project_id column
-- =============================================================================

-- Add project_id column (nullable first, to allow migration of existing rows)
ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE;

-- Assign all existing rows to the default project
UPDATE rag_documents
SET project_id = (SELECT project_id FROM projects WHERE vdb_namespace = 'default')
WHERE project_id IS NULL;

-- Now make the column NOT NULL (all rows assigned)
-- ALTER TABLE rag_documents ALTER COLUMN project_id SET NOT NULL;
-- NOTE: Run this line manually after verifying UPDATE above completed correctly.

-- Index: fast project-scoped vector search
CREATE INDEX IF NOT EXISTS idx_rag_documents_project_id
    ON rag_documents(project_id);


-- =============================================================================
-- STEP 4: Create faq_entries table (structured Q&A, auto-generated from PDFs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS faq_entries (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID         NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    question    TEXT         NOT NULL,
    answer      TEXT         NOT NULL,
    source      VARCHAR(50)  DEFAULT 'pdf_generated',  -- 'pdf_generated' | 'manual'
    source_file VARCHAR(255),                           -- original filename that generated this FAQ
    created_at  TIMESTAMP    DEFAULT NOW()
);

-- Index: project-scoped FAQ lookups
CREATE INDEX IF NOT EXISTS idx_faq_entries_project_id
    ON faq_entries(project_id);

-- Index: PostgreSQL full-text search on question column (GIN)
-- Used in Phase 5 query flow: keyword match before falling back to RAG
CREATE INDEX IF NOT EXISTS idx_faq_entries_question_fts
    ON faq_entries
    USING GIN (to_tsvector('english', question));


-- =============================================================================
-- STEP 5: Verification queries (run after migration to confirm everything is OK)
-- =============================================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('projects', 'rag_documents', 'faq_entries');

-- Check projects
-- SELECT * FROM projects;

-- Check rag_documents has project_id column
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rag_documents';

-- Check existing rows assigned to default project
-- SELECT project_id, COUNT(*) FROM rag_documents GROUP BY project_id;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('rag_documents', 'faq_entries', 'projects');


-- =============================================================================
-- REFERENCE: Full schema after migration
-- =============================================================================

-- projects
-- ├── project_id    UUID PK
-- ├── project_name  VARCHAR(255)
-- ├── vdb_namespace VARCHAR(255) UNIQUE
-- ├── created_at    TIMESTAMP
-- └── updated_at    TIMESTAMP (auto-updated by trigger)
--
-- rag_documents (existing table + project_id added)
-- ├── id            TEXT PK
-- ├── embedding     vector(1024)
-- ├── text          TEXT
-- ├── metadata      JSONB
-- ├── created_at    TIMESTAMP
-- └── project_id    UUID FK → projects.project_id  ← NEW
--
-- faq_entries (new table)
-- ├── id            UUID PK
-- ├── project_id    UUID FK → projects.project_id
-- ├── question      TEXT
-- ├── answer        TEXT
-- ├── source        VARCHAR(50) DEFAULT 'pdf_generated'
-- ├── source_file   VARCHAR(255)
-- └── created_at    TIMESTAMP
