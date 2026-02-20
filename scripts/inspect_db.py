"""
Utility script to inspect the vector database and see stored chunks.
Run this to check how many vectors/chunks are stored and view their details.

Usage:
    python scripts/inspect_db.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
from config import VECTOR_DB_CONFIG, EMBEDDING_CONFIG
from src.embeddings import get_embedding_provider
from src.vector_databases import get_vector_database


def calculate_chunks_for_text(text_length, chunk_size=400, overlap=100):
    """
    Calculate how many chunks will be created for a given text length.

    Args:
        text_length: Length of text in characters
        chunk_size: Size of each chunk
        overlap: Overlap between chunks

    Returns:
        Number of chunks that will be created
    """
    if text_length == 0:
        return 0

    # Formula: chunks = ceil((text_length - overlap) / (chunk_size - overlap))
    step_size = chunk_size - overlap
    chunks = 1 + max(0, (text_length - chunk_size + step_size - 1) // step_size)
    return chunks


def estimate_chunks_for_file(file_type, file_size_kb):
    """
    Estimate chunks for a file based on type and size.

    Args:
        file_type: File extension (.pdf, .docx, .txt, .xlsx)
        file_size_kb: File size in KB

    Returns:
        Estimated number of chunks
    """
    # Rough estimates of text extraction ratios
    extraction_ratios = {
        '.txt': 1.0,      # 1KB file = ~1000 chars
        '.pdf': 0.6,      # PDFs have formatting overhead
        '.docx': 0.7,     # DOCX has some overhead
        '.xlsx': 0.5,     # Excel has lots of structure
    }

    ratio = extraction_ratios.get(file_type.lower(), 0.6)
    estimated_chars = file_size_kb * 1000 * ratio

    return calculate_chunks_for_text(int(estimated_chars))


def inspect_database():
    """Main function to inspect the vector database."""

    print("\n" + "=" * 80)
    print("VECTOR DATABASE INSPECTOR")
    print("=" * 80)

    # Initialize components
    print("\n1. Initializing database connection...")
    embedder = get_embedding_provider(EMBEDDING_CONFIG)
    vector_db = get_vector_database(VECTOR_DB_CONFIG, embedder.get_dimensions())

    print(f"   ✓ Connected to: {VECTOR_DB_CONFIG['provider']}")
    print(f"   ✓ Embedding model: {embedder.get_model_name()}")
    print(f"   ✓ Embedding dimensions: {embedder.get_dimensions()}")

    # Get database statistics
    print("\n2. Database Statistics:")
    print("-" * 80)
    stats = vector_db.get_stats()

    for key, value in stats.items():
        print(f"   {key.replace('_', ' ').title()}: {value}")

    total_vectors = stats.get("total_vectors", 0)

    if total_vectors == 0:
        print("\n   ⚠️  Database is empty! Upload some documents first.")
        print("\n   To upload: POST http://localhost:8000/upload")
        print("   Or run: python simple_rag.py")
        return

    # Calculate storage estimates
    print("\n3. Storage Analysis:")
    print("-" * 80)

    dimensions = embedder.get_dimensions()
    bytes_per_vector = dimensions * 4  # float32 = 4 bytes
    total_bytes = total_vectors * bytes_per_vector
    total_mb = total_bytes / (1024 * 1024)

    print(f"   Vectors stored: {total_vectors:,}")
    print(f"   Bytes per vector: {bytes_per_vector:,} bytes")
    print(f"   Total storage: {total_mb:.2f} MB")

    # Provider-specific details
    print("\n4. Provider-Specific Details:")
    print("-" * 80)

    provider = VECTOR_DB_CONFIG["provider"]

    if provider == "faiss":
        print(f"   Index type: {stats.get('index_type', 'Unknown')}")
        print(f"   Persistence: Manual (use /save endpoint)")
        persist_path = VECTOR_DB_CONFIG.get("faiss", {}).get("persist_path", "N/A")
        print(f"   Save path: {persist_path}")

        # Check if index file exists
        import os
        if os.path.exists(persist_path):
            size_mb = os.path.getsize(persist_path) / (1024 * 1024)
            print(f"   Saved index size: {size_mb:.2f} MB")
        else:
            print(f"   ⚠️  Index not saved to disk yet!")

    elif provider == "chromadb":
        print(f"   Collection: {stats.get('collection_name', 'Unknown')}")
        print(f"   Persistence: Auto")
        persist_dir = stats.get("persist_directory", "N/A")
        print(f"   Persist directory: {persist_dir}")

        # Check directory size
        import os
        if os.path.exists(persist_dir):
            total_size = sum(
                os.path.getsize(os.path.join(dirpath, filename))
                for dirpath, _, filenames in os.walk(persist_dir)
                for filename in filenames
            )
            size_mb = total_size / (1024 * 1024)
            print(f"   Directory size: {size_mb:.2f} MB")

    elif provider == "pgvector":
        print(f"   Table: {stats.get('table_name', 'Unknown')}")
        print(f"   Connection: PostgreSQL")
        print(f"   Persistence: Auto (database)")

        # Try to get more details from PostgreSQL
        try:
            import psycopg2
            conn_string = VECTOR_DB_CONFIG.get("pgvector", {}).get("connection_string")
            if conn_string:
                conn = psycopg2.connect(conn_string)
                cur = conn.cursor()

                table_name = stats.get('table_name', 'rag_documents')

                # Get table size
                cur.execute(f"""
                    SELECT pg_size_pretty(pg_total_relation_size('{table_name}'));
                """)
                table_size = cur.fetchone()[0]
                print(f"   Table size: {table_size}")

                # Get index size
                cur.execute(f"""
                    SELECT pg_size_pretty(pg_indexes_size('{table_name}'));
                """)
                index_size = cur.fetchone()[0]
                print(f"   Index size: {index_size}")

                cur.close()
                conn.close()
        except Exception as e:
            print(f"   (Unable to get PostgreSQL details: {e})")

    elif provider == "pinecone":
        print(f"   Index: {stats.get('index_name', 'Unknown')}")
        print(f"   Persistence: Auto (cloud)")
        print(f"   Location: Cloud-managed")

    # Chunk calculation examples
    print("\n5. Chunk Calculation Examples:")
    print("-" * 80)
    print("   Based on current settings (chunk_size=400, overlap=100):")
    print()

    examples = [
        ("Small doc (1 page PDF)", 2, ".pdf", 500),
        ("Medium doc (5 pages)", 10, ".pdf", 2500),
        ("Large doc (20 pages)", 50, ".pdf", 10000),
        ("Excel file", 15, ".xlsx", 3000),
        ("DOCX document", 8, ".docx", 2000),
    ]

    for name, size_kb, file_type, chars in examples:
        chunks = calculate_chunks_for_text(chars)
        print(f"   {name:25} → ~{chunks:3} chunks  ({chars:,} chars)")

    # Sample metadata (if available)
    print("\n6. Sample Data:")
    print("-" * 80)

    if provider == "faiss":
        # Show first few chunks
        if hasattr(vector_db, 'chunks') and len(vector_db.chunks) > 0:
            print(f"   Showing first 3 of {len(vector_db.chunks)} chunks:\n")
            for i, chunk in enumerate(vector_db.chunks[:3], 1):
                print(f"   Chunk {i}:")
                print(f"     ID: {chunk['id']}")
                print(f"     Text: {chunk['text'][:100]}...")
                print(f"     Metadata: {json.dumps(chunk['metadata'], indent=6)}")
                print()
        else:
            print("   No chunk metadata available in memory.")

    elif provider == "pgvector":
        try:
            import psycopg2
            conn_string = VECTOR_DB_CONFIG.get("pgvector", {}).get("connection_string")
            table_name = VECTOR_DB_CONFIG.get("pgvector", {}).get("table_name", "rag_documents")

            if conn_string:
                conn = psycopg2.connect(conn_string)
                cur = conn.cursor()

                cur.execute(f"""
                    SELECT id, text, metadata, created_at
                    FROM {table_name}
                    ORDER BY created_at DESC
                    LIMIT 3
                """)

                rows = cur.fetchall()

                if rows:
                    print(f"   Showing 3 most recent chunks:\n")
                    for i, (id, text, metadata, created_at) in enumerate(rows, 1):
                        print(f"   Chunk {i}:")
                        print(f"     ID: {id}")
                        print(f"     Text: {text[:100]}...")
                        print(f"     Metadata: {json.dumps(metadata, indent=6)}")
                        print(f"     Created: {created_at}")
                        print()

                # Show chunks per document
                cur.execute(f"""
                    SELECT
                        metadata->>'filename' as filename,
                        metadata->>'document_id' as doc_id,
                        COUNT(*) as chunk_count
                    FROM {table_name}
                    GROUP BY metadata->>'filename', metadata->>'document_id'
                    ORDER BY chunk_count DESC
                """)

                doc_stats = cur.fetchall()

                if doc_stats:
                    print("   Chunks per document:")
                    print("   " + "-" * 76)
                    print(f"   {'Filename':<40} {'Doc ID':<25} {'Chunks':>8}")
                    print("   " + "-" * 76)
                    for filename, doc_id, count in doc_stats:
                        print(f"   {filename[:40]:<40} {doc_id[:25]:<25} {count:8}")

                cur.close()
                conn.close()
        except Exception as e:
            print(f"   Unable to fetch sample data: {e}")

    print("\n" + "=" * 80)
    print("INSPECTION COMPLETE")
    print("=" * 80)
    print("\nQuick Reference:")
    print("  • View via API: GET http://localhost:8000/status")
    print("  • Upload file: POST http://localhost:8000/upload")
    print("  • Query: POST http://localhost:8000/query")
    print("  • Reset DB: DELETE http://localhost:8000/reset")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    try:
        inspect_database()
    except KeyboardInterrupt:
        print("\n\nInspection cancelled.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
