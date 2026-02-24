-- ==============================================================================
-- PGVECTOR COMPLETE SETUP SQL
-- Run this file to set up PostgreSQL + pgvector for the SellBot RAG system
-- Usage: sudo -u postgres psql -f pgvector_setup.sql
-- ==============================================================================


-- ==============================================================================
-- STEP 1: CREATE DATABASE AND USER
-- Run as postgres superuser
-- ==============================================================================

-- Create the database
CREATE DATABASE rag_db;

-- Create dedicated app user
CREATE USER rag_user WITH PASSWORD 'secure_password';

-- Grant database access
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;

-- Connect to the new database
\c rag_db


-- ==============================================================================
-- STEP 2: ENABLE PGVECTOR EXTENSION
-- Must be superuser; only needs to be done once per database
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension installed
\dx


-- ==============================================================================
-- STEP 3: GRANT SCHEMA PERMISSIONS TO APP USER
-- Required so rag_user can create tables and use the vector type
-- ==============================================================================

GRANT ALL ON SCHEMA public TO rag_user;
GRANT USAGE ON SCHEMA public TO rag_user;


-- ==============================================================================
-- STEP 4: VERIFY EVERYTHING
-- ==============================================================================

-- Confirm vector extension is present
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';

-- Confirm rag_user exists
SELECT usename, usesuper
FROM pg_user
WHERE usename = 'rag_user';


-- ==============================================================================
-- NOTE: The RAG app auto-creates the table and index on first startup.
-- But if you want to create it manually, run the section below.
-- ==============================================================================


-- ==============================================================================
-- STEP 5 (OPTIONAL): MANUALLY CREATE TABLE + INDEX
-- The app runs this automatically via PgVectorDatabase._setup_database()
-- Only run manually if you need to pre-create or inspect the schema
-- ==============================================================================

-- Connect as rag_user (or stay as postgres)
-- \c rag_db rag_user

-- Create the vectors table
CREATE TABLE IF NOT EXISTS rag_documents (
    id          TEXT PRIMARY KEY,
    embedding   vector(1024),           -- 1024 dims = BAAI/bge-large-en-v1.5
    text        TEXT,
    metadata    JSONB,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create HNSW index for cosine similarity search (auto-created by app)
CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx
    ON rag_documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Verify table structure
\d rag_documents

-- Verify index
\di rag_documents*


-- ==============================================================================
-- INSPECTION QUERIES (run anytime to check state)
-- ==============================================================================

-- Count total stored vectors
SELECT COUNT(*) AS total_vectors FROM rag_documents;

-- View sample rows
SELECT id, text, metadata, created_at
FROM rag_documents
LIMIT 3;

-- Check embedding dimensions of stored vectors
SELECT id, array_length(embedding::real[], 1) AS dims
FROM rag_documents
LIMIT 1;

-- Check table size on disk
SELECT pg_size_pretty(pg_total_relation_size('rag_documents')) AS table_size;

-- Check index usage stats
SELECT indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE relname = 'rag_documents';


-- ==============================================================================
-- VECTOR SEARCH QUERIES
-- ==============================================================================

-- Manual cosine similarity search (replace array with real 1024-dim vector)
-- SELECT id, text, metadata,
--        1 - (embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) AS similarity
-- FROM rag_documents
-- ORDER BY embedding <=> '[0.1, 0.2, 0.3, ...]'::vector
-- LIMIT 10;

-- Hybrid: SQL filter on metadata + vector similarity
-- SELECT id, text, metadata,
--        1 - (embedding <=> '[...]'::vector) AS similarity
-- FROM rag_documents
-- WHERE metadata->>'filename' = 'project_info.txt'
-- ORDER BY embedding <=> '[...]'::vector
-- LIMIT 5;


-- ==============================================================================
-- PERFORMANCE: OPTIONAL IVFFLAT INDEX (for > 10,000 vectors)
-- The HNSW index above is sufficient for small-medium datasets.
-- Switch to IVFFlat for very large collections.
-- ==============================================================================

-- DROP INDEX IF EXISTS rag_documents_embedding_idx;
--
-- CREATE INDEX rag_documents_ivfflat_idx
--     ON rag_documents
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);   -- lists ≈ sqrt(total_row_count)
--
-- ANALYZE rag_documents;


-- ==============================================================================
-- RESET / CLEANUP QUERIES
-- ==============================================================================

-- Delete all vectors (keeps table + index intact — same as DELETE /reset endpoint)
-- DELETE FROM rag_documents;

-- Drop table entirely (required when changing embedding dimensions)
-- DROP TABLE IF EXISTS rag_documents;

-- Drop extension (only if removing pgvector completely)
-- DROP EXTENSION IF EXISTS vector;


-- ==============================================================================
-- ACTIVE CONNECTIONS MANAGEMENT
-- ==============================================================================

-- View all active connections to rag_db
SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity
WHERE datname = 'rag_db';

-- Kill idle/zombie connections (run if app crashed and left connections open)
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = 'rag_db'
--   AND state = 'idle'
--   AND pid <> pg_backend_pid();


-- ==============================================================================
-- BACKUP / RESTORE COMMANDS (run in terminal, not psql)
-- ==============================================================================

-- Backup:
--   pg_dump rag_db > rag_db_backup_$(date +%Y%m%d).sql
--
-- Restore:
--   psql rag_db < rag_db_backup_20260223.sql


-- ==============================================================================
-- FINAL VERIFICATION CHECKLIST
-- ==============================================================================

-- 1. Extension installed?
SELECT 'pgvector installed: ' || extversion AS status FROM pg_extension WHERE extname = 'vector';

-- 2. Table exists?
SELECT 'Table exists: ' || tablename AS status FROM pg_tables WHERE tablename = 'rag_documents';

-- 3. Index exists?
SELECT 'Index exists: ' || indexname AS status FROM pg_indexes WHERE tablename = 'rag_documents';

-- 4. Row count
SELECT 'Vectors stored: ' || COUNT(*) AS status FROM rag_documents;
