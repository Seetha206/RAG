"""FAQ database operations using the existing psycopg2 connection from PgVectorDatabase."""

from typing import List, Optional, Dict, Any


# Fixed category metadata — must match faq_generator.py FIXED_CATEGORIES
CATEGORY_CONFIG = {
    "Pricing":        {"color": "#3b82f6", "icon": "DollarSign"},
    "Amenities":      {"color": "#8b5cf6", "icon": "Sparkles"},
    "Location":       {"color": "#14b8a6", "icon": "MapPin"},
    "Process":        {"color": "#f59e0b", "icon": "ClipboardList"},
    "Specifications": {"color": "#ec4899", "icon": "Ruler"},
    "Security":       {"color": "#ef4444", "icon": "Shield"},
    "General":        {"color": "#6b7280", "icon": "Info"},
}


def setup_faq_table(conn) -> None:
    """Create faq_entries table and indexes if they don't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS faq_entries (
                id          SERIAL PRIMARY KEY,
                project_id  UUID REFERENCES projects(project_id) ON DELETE CASCADE,
                question    TEXT NOT NULL,
                answer      TEXT NOT NULL,
                category    VARCHAR(100) NOT NULL DEFAULT 'General',
                source_file VARCHAR(255),
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_faq_category
            ON faq_entries(category);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_faq_project_id
            ON faq_entries(project_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_faq_fts
            ON faq_entries
            USING GIN (to_tsvector('english', question));
        """)
    print("FAQ table ready.")


def store_faqs(
    faqs: List[Dict[str, Any]],
    source_file: str,
    conn,
    project_id: Optional[str] = None
) -> int:
    """
    Bulk insert FAQ entries. Skips exact duplicate questions from the same source file.
    Uses a single SELECT to find existing duplicates, then one bulk INSERT (ISSUE_010).

    Args:
        faqs: List of {question, answer, category} dicts
        source_file: Original filename (for attribution)
        conn: psycopg2 connection
        project_id: UUID of the owning project (None = no project scoping)

    Returns:
        Number of FAQs actually inserted
    """
    if not faqs:
        return 0

    from psycopg2.extras import execute_values

    # Validate and normalise all FAQ entries first
    normalized: List[tuple] = []
    for faq in faqs:
        question = faq.get("question", "").strip()
        answer = faq.get("answer", "").strip()
        category = faq.get("category", "General").strip()
        if not question or not answer:
            continue
        if category not in CATEGORY_CONFIG:
            category = "General"
        normalized.append((question, answer, category))

    if not normalized:
        return 0

    with conn.cursor() as cur:
        # Single query to find questions already stored for this file+project (ISSUE_010)
        all_questions = [q for q, _, _ in normalized]
        if project_id:
            cur.execute(
                """SELECT question FROM faq_entries
                   WHERE source_file = %s AND project_id = %s::uuid
                     AND question = ANY(%s)""",
                (source_file, project_id, all_questions)
            )
        else:
            cur.execute(
                """SELECT question FROM faq_entries
                   WHERE source_file = %s AND project_id IS NULL
                     AND question = ANY(%s)""",
                (source_file, all_questions)
            )
        existing = {row[0] for row in cur.fetchall()}

        # Filter out duplicates in Python — no per-row DB round-trip
        new_faqs = [(q, a, c) for q, a, c in normalized if q not in existing]

        if not new_faqs:
            return 0

        # Bulk insert all new FAQs in one statement
        execute_values(
            cur,
            """INSERT INTO faq_entries (project_id, question, answer, category, source_file)
               VALUES %s""",
            [(project_id, q, a, c, source_file) for q, a, c in new_faqs],
            template="(%s::uuid, %s, %s, %s, %s)"
        )

    return len(new_faqs)


def get_all_faqs(conn, project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch FAQs grouped by category for the mind map.

    Args:
        conn: psycopg2 connection
        project_id: Filter to a specific project (None = all projects)

    Returns:
        {
            "categories": [
                {
                    "name": "Pricing",
                    "color": "#3b82f6",
                    "icon": "DollarSign",
                    "faqs": [{"id": 1, "question": "...", "answer": "...", "source_file": "..."}]
                },
                ...
            ],
            "total": 45
        }
    """
    with conn.cursor() as cur:
        if project_id:
            cur.execute("""
                SELECT id, question, answer, category, source_file
                FROM faq_entries
                WHERE project_id = %s::uuid
                ORDER BY category, id
            """, (project_id,))
        else:
            cur.execute("""
                SELECT id, question, answer, category, source_file
                FROM faq_entries
                ORDER BY category, id
            """)
        rows = cur.fetchall()

    # Group by category
    # Rule: General category ONLY shows user_chat entries (AI chat questions).
    # Document-generated FAQs categorised as General are excluded from the map.
    grouped: Dict[str, List] = {cat: [] for cat in CATEGORY_CONFIG}

    for row in rows:
        faq_id, question, answer, category, source_file = row
        cat_key = category if category in CATEGORY_CONFIG else "General"
        if cat_key == "General" and source_file != "user_chat":
            continue  # Only AI-chat questions belong in General
        grouped[cat_key].append({
            "id": faq_id,
            "question": question,
            "answer": answer,
            "source_file": source_file,
        })

    # Build ordered response — only include categories that have FAQs
    categories = []
    for cat_name, meta in CATEGORY_CONFIG.items():
        if grouped[cat_name]:
            categories.append({
                "name": cat_name,
                "color": meta["color"],
                "icon": meta["icon"],
                "faqs": grouped[cat_name],
            })

    return {
        "categories": categories,
        "total": len(rows),
    }


def search_faq(
    question: str,
    conn,
    project_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Search FAQ entries using PostgreSQL full-text search.
    Returns the best matching FAQ or None if no good match found.

    Args:
        question: User's question string
        conn: psycopg2 connection
        project_id: Limit search to a specific project (None = all projects)

    Returns:
        {question, answer, category, source_file, rank} or None
    """
    if not question or not question.strip():
        return None

    with conn.cursor() as cur:
        if project_id:
            cur.execute(
                """
                SELECT id, question, answer, category, source_file,
                       ts_rank(to_tsvector('english', question), plainto_tsquery('english', %s)) AS rank
                FROM faq_entries
                WHERE project_id = %s
                  AND to_tsvector('english', question) @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT 1
                """,
                (question, project_id, question)
            )
        else:
            cur.execute(
                """
                SELECT id, question, answer, category, source_file,
                       ts_rank(to_tsvector('english', question), plainto_tsquery('english', %s)) AS rank
                FROM faq_entries
                WHERE to_tsvector('english', question) @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT 1
                """,
                (question, question)
            )
        row = cur.fetchone()

    if not row:
        return None

    faq_id, q, answer, category, source_file, rank = row

    # Only return if rank is meaningful — raised from 0.01 → 0.15 (ISSUE_019)
    # 0.15 requires a phrase-level match; 0.01 fired on any single keyword overlap
    if rank < 0.15:
        return None

    return {
        "id": faq_id,
        "question": q,
        "answer": answer,
        "category": category,
        "source_file": source_file,
        "rank": float(rank),
    }


def delete_faqs_by_file(
    source_file: str,
    conn,
    project_id: Optional[str] = None
) -> int:
    """Delete all FAQs from a specific source file (useful for re-upload)."""
    with conn.cursor() as cur:
        if project_id:
            cur.execute(
                "DELETE FROM faq_entries WHERE source_file = %s AND project_id = %s",
                (source_file, project_id)
            )
        else:
            cur.execute(
                "DELETE FROM faq_entries WHERE source_file = %s",
                (source_file,)
            )
        return cur.rowcount


def upsert_chat_faq(
    question: str,
    answer: str,
    conn,
    project_id: Optional[str] = None
) -> str:
    """
    Upsert a user_chat FAQ entry (AI chat auto-save, General category).

    - If an identical question (case-insensitive) already exists for this
      project with source_file='user_chat', UPDATE the answer in-place.
    - Otherwise INSERT a new row.

    Returns 'updated' or 'inserted'.
    """
    question = question.strip()
    answer = answer.strip()
    if not question or not answer:
        return "skipped"

    with conn.cursor() as cur:
        # Check for an existing entry with the same question (case-insensitive)
        if project_id:
            cur.execute(
                """SELECT id FROM faq_entries
                   WHERE source_file = 'user_chat'
                     AND project_id = %s::uuid
                     AND LOWER(question) = LOWER(%s)
                   LIMIT 1""",
                (project_id, question)
            )
        else:
            cur.execute(
                """SELECT id FROM faq_entries
                   WHERE source_file = 'user_chat'
                     AND project_id IS NULL
                     AND LOWER(question) = LOWER(%s)
                   LIMIT 1""",
                (question,)
            )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                "UPDATE faq_entries SET answer = %s WHERE id = %s",
                (answer, existing[0])
            )
            return "updated"
        else:
            if project_id:
                cur.execute(
                    """INSERT INTO faq_entries (project_id, question, answer, category, source_file)
                       VALUES (%s::uuid, %s, %s, 'General', 'user_chat')""",
                    (project_id, question, answer)
                )
            else:
                cur.execute(
                    """INSERT INTO faq_entries (project_id, question, answer, category, source_file)
                       VALUES (NULL, %s, %s, 'General', 'user_chat')""",
                    (question, answer)
                )
            return "inserted"


def delete_faq_by_id(faq_id: int, conn, project_id: Optional[str] = None) -> bool:
    """
    Delete a single FAQ entry by its primary key.
    Scopes to project_id when provided (safety guard).
    Returns True if a row was deleted, False if not found.
    """
    with conn.cursor() as cur:
        if project_id:
            cur.execute(
                "DELETE FROM faq_entries WHERE id = %s AND project_id = %s::uuid",
                (faq_id, project_id)
            )
        else:
            cur.execute("DELETE FROM faq_entries WHERE id = %s", (faq_id,))
        return cur.rowcount > 0


def delete_chat_faqs(conn, project_id: Optional[str] = None) -> int:
    """
    Delete all user_chat FAQ entries for a project (General category clear-all).
    Returns the number of rows deleted.
    """
    with conn.cursor() as cur:
        if project_id:
            cur.execute(
                "DELETE FROM faq_entries WHERE source_file = 'user_chat' AND project_id = %s::uuid",
                (project_id,)
            )
        else:
            cur.execute("DELETE FROM faq_entries WHERE source_file = 'user_chat'")
        return cur.rowcount
