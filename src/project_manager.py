"""Project management — CRUD for the `projects` table."""

from typing import List, Optional, Dict, Any


def create_project(name: str, conn) -> Dict[str, Any]:
    """
    Create a new project.

    Args:
        name: Human-readable project name
        conn: psycopg2 connection

    Returns:
        {project_id, project_name, vdb_namespace, created_at}
    """
    # vdb_namespace matches project_id (UUID) for pgvector row-level scoping
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO projects (project_name, vdb_namespace)
            VALUES (%s, gen_random_uuid()::text)
            RETURNING project_id::text, project_name, vdb_namespace, created_at
            """,
            (name,)
        )
        row = cur.fetchone()

    return {
        "project_id":   row[0],
        "project_name": row[1],
        "vdb_namespace": row[2],
        "created_at":   row[3].isoformat() if row[3] else None,
    }


def list_projects(conn) -> List[Dict[str, Any]]:
    """Return all user-created projects ordered by creation time.
    Excludes the system Default Project (vdb_namespace='default').
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT project_id::text, project_name, vdb_namespace, created_at
            FROM projects
            WHERE vdb_namespace != 'default'
            ORDER BY created_at ASC
        """)
        rows = cur.fetchall()

    return [
        {
            "project_id":    row[0],
            "project_name":  row[1],
            "vdb_namespace": row[2],
            "created_at":    row[3].isoformat() if row[3] else None,
        }
        for row in rows
    ]


def get_project(project_id: str, conn) -> Optional[Dict[str, Any]]:
    """
    Fetch a single project by UUID.

    Returns:
        Project dict or None if not found
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT project_id::text, project_name, vdb_namespace, created_at
            FROM projects
            WHERE project_id = %s::uuid
            """,
            (project_id,)
        )
        row = cur.fetchone()

    if not row:
        return None

    return {
        "project_id":    row[0],
        "project_name":  row[1],
        "vdb_namespace": row[2],
        "created_at":    row[3].isoformat() if row[3] else None,
    }


def delete_project(project_id: str, conn) -> bool:
    """
    Delete a project and all its data (CASCADE removes rag_documents + faq_entries).

    Args:
        project_id: UUID string of the project to delete

    Returns:
        True if deleted, False if not found
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM projects WHERE project_id = %s::uuid",
            (project_id,)
        )
        return cur.rowcount > 0


def get_or_create_default_project(conn) -> str:
    """
    Ensure the Default Project exists and return its UUID string.
    Called at app startup to guarantee a fallback project_id.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT project_id::text FROM projects WHERE vdb_namespace = 'default' LIMIT 1"
        )
        row = cur.fetchone()
        if row:
            return row[0]

        # Create it if missing (first-time setup before migration is run)
        cur.execute(
            """
            INSERT INTO projects (project_name, vdb_namespace)
            VALUES ('Default Project', 'default')
            ON CONFLICT (vdb_namespace) DO NOTHING
            RETURNING project_id::text
            """
        )
        row = cur.fetchone()
        if row:
            return row[0]

        # Race condition fallback — re-read
        cur.execute(
            "SELECT project_id::text FROM projects WHERE vdb_namespace = 'default' LIMIT 1"
        )
        return cur.fetchone()[0]
