"""
Multi-Project Migration Script — Phase 1
=========================================
Run this ONCE to migrate from single-tenant to multi-project schema.

What this does:
  1. Creates the `projects` table (UUID PK)
  2. Inserts a "Default Project" for all existing data
  3. Adds `project_id UUID` column to `rag_documents` + updates existing rows
  4. Adds `project_id UUID` column to `faq_entries` + updates existing rows
  5. Creates all necessary indexes

Usage:
  cd /path/to/RAG
  python scripts/migrate_multiproject.py

The script is idempotent — safe to re-run.
"""

import os
import sys

# Allow imports from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import psycopg2
from config import VECTOR_DB_CONFIG


def run_migration():
    conn_str = VECTOR_DB_CONFIG["pgvector"]["connection_string"]
    print(f"\nConnecting to PostgreSQL...")
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()

    print("Starting multi-project migration...\n")

    # -----------------------------------------------------------------------
    # Step 1: Create projects table
    # -----------------------------------------------------------------------
    print("Step 1: Creating `projects` table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            project_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_name VARCHAR(255) NOT NULL,
            vdb_namespace VARCHAR(255) NOT NULL UNIQUE,
            created_at   TIMESTAMP DEFAULT NOW(),
            updated_at   TIMESTAMP DEFAULT NOW()
        );
    """)
    print("  ✓ projects table ready")

    # -----------------------------------------------------------------------
    # Step 2: Insert Default Project (if not exists)
    # -----------------------------------------------------------------------
    print("Step 2: Inserting Default Project...")
    cur.execute("""
        INSERT INTO projects (project_name, vdb_namespace)
        VALUES ('Default Project', 'default')
        ON CONFLICT (vdb_namespace) DO NOTHING;
    """)
    cur.execute("SELECT project_id FROM projects WHERE vdb_namespace = 'default';")
    default_project_id = cur.fetchone()[0]
    print(f"  ✓ Default Project ID: {default_project_id}")

    # -----------------------------------------------------------------------
    # Step 3: Add project_id to rag_documents
    # -----------------------------------------------------------------------
    print("Step 3: Updating `rag_documents` table...")

    # Check if column already exists
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'rag_documents' AND column_name = 'project_id';
    """)
    if cur.fetchone():
        print("  ✓ project_id column already exists in rag_documents — skipping")
    else:
        # Check if rag_documents table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'rag_documents'
            );
        """)
        if cur.fetchone()[0]:
            cur.execute("""
                ALTER TABLE rag_documents
                ADD COLUMN project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE;
            """)
            cur.execute(
                "UPDATE rag_documents SET project_id = %s WHERE project_id IS NULL;",
                (default_project_id,)
            )
            updated = cur.rowcount
            print(f"  ✓ Added project_id column, updated {updated} existing rows")

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_rag_documents_project_id
                ON rag_documents(project_id);
            """)
            print("  ✓ Created index on rag_documents.project_id")
        else:
            print("  ✓ rag_documents table doesn't exist yet — will be created with project_id by app startup")

    # -----------------------------------------------------------------------
    # Step 4: Add project_id to faq_entries
    # -----------------------------------------------------------------------
    print("Step 4: Updating `faq_entries` table...")

    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'faq_entries' AND column_name = 'project_id';
    """)
    if cur.fetchone():
        print("  ✓ project_id column already exists in faq_entries — skipping")
    else:
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'faq_entries'
            );
        """)
        if cur.fetchone()[0]:
            cur.execute("""
                ALTER TABLE faq_entries
                ADD COLUMN project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE;
            """)
            cur.execute(
                "UPDATE faq_entries SET project_id = %s WHERE project_id IS NULL;",
                (default_project_id,)
            )
            updated = cur.rowcount
            print(f"  ✓ Added project_id column, updated {updated} existing rows")

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_faq_entries_project_id
                ON faq_entries(project_id);
            """)
            print("  ✓ Created index on faq_entries.project_id")
        else:
            print("  ✓ faq_entries table doesn't exist yet — will be created with project_id by app startup")

    # -----------------------------------------------------------------------
    # Done
    # -----------------------------------------------------------------------
    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("✓ Migration complete!")
    print(f"  Default Project ID: {default_project_id}")
    print("  Add this to your .env if you want to hardcode it:")
    print(f"  DEFAULT_PROJECT_ID={default_project_id}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_migration()
