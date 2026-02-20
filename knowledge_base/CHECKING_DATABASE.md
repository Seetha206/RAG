# How to Check Database Contents and Understand Chunk Storage

## Quick Answer

**To check how many chunks are stored:**
```bash
# Method 1: API endpoint (if server is running)
curl http://localhost:8000/status

# Method 2: Run inspection script
python inspect_db.py

# Method 3: Direct database query (pgvector only)
psql -d rag_db -c "SELECT COUNT(*) FROM rag_documents;"
```

## Understanding Chunks

### What is a Chunk?

A **chunk** is a piece of text split from your document. Each chunk becomes one **vector** in the database.

```
Document (1000 characters)
    ↓ Split into chunks (chunk_size=400, overlap=100)
    ↓
Chunk 1: chars 0-400
Chunk 2: chars 300-700    (overlaps with chunk 1 by 100 chars)
Chunk 3: chars 600-1000   (overlaps with chunk 2 by 100 chars)
    ↓ Convert each chunk to embedding
    ↓
3 vectors stored in database
```

### Chunk Calculation Formula

Based on `config.py:125-126`:
- **chunk_size = 400** characters
- **chunk_overlap = 100** characters

```python
# Formula
step_size = chunk_size - overlap = 400 - 100 = 300
number_of_chunks = ceil(text_length / step_size)

# Example:
text_length = 1000 characters
chunks = ceil(1000 / 300) = 4 chunks
```

### Examples by File Size

| File Type | File Size | Extracted Text | Chunks Created |
|-----------|-----------|----------------|----------------|
| **Small TXT** | 1 KB | ~1000 chars | ~4 chunks |
| **PDF (1 page)** | 50 KB | ~3000 chars | ~10 chunks |
| **PDF (5 pages)** | 200 KB | ~15,000 chars | ~50 chunks |
| **DOCX (10 pages)** | 100 KB | ~10,000 chars | ~34 chunks |
| **Excel (3 sheets)** | 50 KB | ~5,000 chars | ~17 chunks |
| **Large PDF (50 pages)** | 1 MB | ~150,000 chars | ~500 chunks |

**Key Point:** Number of chunks depends on **extracted text length**, not file size!

---

## Method 1: API Endpoint (Easiest)

### Prerequisites
```bash
# Start the server
uvicorn app:app --reload
```

### Check Status
```bash
# Using curl
curl http://localhost:8000/status

# Using Python requests
python -c "import requests; print(requests.get('http://localhost:8000/status').json())"
```

### Example Response
```json
{
  "status": "running",
  "total_documents": 5,
  "total_chunks": 147,
  "embedding_model": "local/BAAI/bge-large-en-v1.5",
  "vector_db_provider": "pgvector",
  "llm_model": "gemini/models/gemini-3-flash-preview"
}
```

**What this tells you:**
- ✅ 5 documents uploaded
- ✅ 147 chunks/vectors stored
- ✅ Average ~29 chunks per document

---

## Method 2: Inspection Script (Most Detailed)

### Run the Script
```bash
python inspect_db.py
```

### Example Output
```
================================================================================
VECTOR DATABASE INSPECTOR
================================================================================

1. Initializing database connection...
   ✓ Connected to: pgvector
   ✓ Embedding model: BAAI/bge-large-en-v1.5
   ✓ Embedding dimensions: 1024

2. Database Statistics:
--------------------------------------------------------------------------------
   Provider: pgvector
   Table Name: rag_documents
   Total Vectors: 147
   Dimensions: 1024

3. Storage Analysis:
--------------------------------------------------------------------------------
   Vectors stored: 147
   Bytes per vector: 4,096 bytes
   Total storage: 0.59 MB

4. Provider-Specific Details:
--------------------------------------------------------------------------------
   Table: rag_documents
   Connection: PostgreSQL
   Table size: 672 kB
   Index size: 128 kB

5. Chunk Calculation Examples:
--------------------------------------------------------------------------------
   Based on current settings (chunk_size=400, overlap=100):

   Small doc (1 page PDF)    → ~  2 chunks  (500 chars)
   Medium doc (5 pages)      → ~  9 chunks  (2,500 chars)
   Large doc (20 pages)      → ~ 34 chunks  (10,000 chars)
   Excel file                → ~  6 chunks  (3,000 chars)
   DOCX document             → ~ 17 chunks  (2,000 chars)

6. Sample Data:
--------------------------------------------------------------------------------
   Showing 3 most recent chunks:

   Chunk 1:
     ID: vec_1738355234567_0
     Text: Green Valley Residences is a premium residential project...
     Metadata: {
       "filename": "project_info.txt",
       "document_id": "doc_3_1738355234",
       "chunk_index": 0,
       "total_chunks": 3
     }
     Created: 2025-02-01 10:30:45

   Chunks per document:
   ----------------------------------------------------------------------------
   Filename                                 Doc ID                    Chunks
   ----------------------------------------------------------------------------
   project_info.txt                         doc_3_1738355234              3
   amenities.txt                            doc_2_1738355120             12
   faq.txt                                  doc_1_1738355000             25
```

**What this gives you:**
- ✅ Total vectors/chunks
- ✅ Storage size
- ✅ Sample chunk data
- ✅ Chunks per document breakdown

---

## Method 3: Direct Database Queries (pgvector only)

### Connect to PostgreSQL
```bash
# From command line
psql -U postgres -d rag_db

# Or using connection string
psql postgresql://postgres:password@localhost:5432/rag_db
```

### Query 1: Total Chunk Count
```sql
SELECT COUNT(*) as total_chunks FROM rag_documents;
```

Output:
```
 total_chunks
--------------
          147
```

### Query 2: Chunks Per Document
```sql
SELECT
    metadata->>'filename' as filename,
    metadata->>'document_id' as document_id,
    COUNT(*) as chunks
FROM rag_documents
GROUP BY metadata->>'filename', metadata->>'document_id'
ORDER BY chunks DESC;
```

Output:
```
     filename      |    document_id    | chunks
-------------------+-------------------+--------
 project_info.txt  | doc_1_1738355000  |     53
 amenities.txt     | doc_2_1738355120  |     47
 faq.txt           | doc_3_1738355234  |     47
```

### Query 3: View Sample Chunks
```sql
SELECT
    id,
    LEFT(text, 100) as text_preview,
    metadata->>'filename' as filename,
    metadata->>'chunk_index' as chunk_index
FROM rag_documents
ORDER BY created_at DESC
LIMIT 5;
```

Output:
```
         id         |                     text_preview                      |     filename      | chunk_index
--------------------+-------------------------------------------------------+-------------------+-------------
 vec_1738355234_2   | Q: What is the payment plan? A: We offer flexible... | faq.txt           | 2
 vec_1738355234_1   | Swimming pool, Gym, Children's play area...           | amenities.txt     | 1
 vec_1738355234_0   | Green Valley Residences is a premium residential...  | project_info.txt  | 0
```

### Query 4: Database Size
```sql
-- Table size
SELECT pg_size_pretty(pg_total_relation_size('rag_documents')) as table_size;

-- Index size
SELECT pg_size_pretty(pg_indexes_size('rag_documents')) as index_size;

-- Total database size
SELECT pg_size_pretty(pg_database_size('rag_db')) as db_size;
```

Output:
```
 table_size
------------
 672 kB

 index_size
------------
 128 kB

 db_size
--------
 8945 kB
```

---

## Method 4: FAISS Inspection (if using FAISS)

### Load and Inspect FAISS Index
```python
import faiss
import json

# Load FAISS index
index = faiss.read_index("./vector_store/faiss.index")
print(f"Total vectors: {index.ntotal}")

# Load metadata
with open("./vector_store/metadata.json", "r") as f:
    metadata = json.load(f)

print(f"Total chunks: {len(metadata)}")

# Show first few chunks
for i, chunk in enumerate(metadata[:3], 1):
    print(f"\nChunk {i}:")
    print(f"  ID: {chunk['id']}")
    print(f"  Filename: {chunk['metadata']['filename']}")
    print(f"  Text: {chunk['text'][:100]}...")
```

---

## Method 5: ChromaDB Inspection (if using ChromaDB)

### Query ChromaDB
```python
import chromadb

# Connect to ChromaDB
client = chromadb.PersistentClient(path="./vector_store/chromadb")
collection = client.get_collection(name="rag_documents")

# Get count
count = collection.count()
print(f"Total vectors: {count}")

# Get all items
results = collection.get(limit=10)

print(f"\nFirst 10 documents:")
for i, (id, doc, metadata) in enumerate(zip(
    results['ids'],
    results['documents'],
    results['metadatas']
), 1):
    print(f"\n{i}. ID: {id}")
    print(f"   File: {metadata['filename']}")
    print(f"   Text: {doc[:100]}...")
```

---

## Understanding Chunk Storage Per File

### Real Example: project_info.txt

**File details:**
- Size: 952 bytes
- Content: Project description, pricing, location
- Extracted text: ~950 characters

**Chunk calculation:**
```
chunk_size = 400
chunk_overlap = 100
step_size = 300

Number of chunks = ceil(950 / 300) = 4 chunks

Chunk 0: chars 0-400
Chunk 1: chars 300-700
Chunk 2: chars 600-950
Chunk 3: (if any remaining text)

Result: 3-4 chunks stored
```

### Checking Specific File
```sql
-- For pgvector
SELECT
    metadata->>'chunk_index' as chunk_index,
    LENGTH(text) as text_length,
    LEFT(text, 50) as preview
FROM rag_documents
WHERE metadata->>'filename' = 'project_info.txt'
ORDER BY (metadata->>'chunk_index')::int;
```

Output:
```
 chunk_index | text_length |                    preview
-------------+-------------+------------------------------------------------
 0           |         400 | Green Valley Residences is a premium resident
 1           |         400 | starting at Rs 65 lakhs for 2BHK, Rs 95 lakh
 2           |         350 | and shopping centers within a 5km radius. Co
```

---

## Monitoring Uploads in Real-Time

### Watch Database Grow (pgvector)
```sql
-- Run this in one terminal window
SELECT
    COUNT(*) as total_chunks,
    COUNT(DISTINCT metadata->>'document_id') as total_docs,
    pg_size_pretty(pg_total_relation_size('rag_documents')) as size
FROM rag_documents;

-- Refresh every 2 seconds
\watch 2
```

### Upload and Monitor
```bash
# Terminal 1: Monitor
watch -n 1 'curl -s http://localhost:8000/status | jq'

# Terminal 2: Upload files
curl -X POST http://localhost:8000/upload \
  -F "file=@sample_documents/project_info.txt"

# Watch the chunk count increase!
```

---

## Upload Response Details

When you upload a file via API, the response shows chunk details:

```json
{
  "status": "success",
  "message": "Document processed successfully",
  "document_id": "doc_5_1738355234",
  "filename": "project_info.txt",
  "file_info": {
    "filename": "project_info.txt",
    "extension": "txt",
    "size_bytes": 952,
    "size_mb": 0.00091
  },
  "chunks_added": 3,           ← How many chunks created from THIS file
  "total_chunks": 150,         ← Total chunks in database now
  "processing_time_ms": 245.32
}
```

**Key fields:**
- `chunks_added`: Chunks created from the uploaded file
- `total_chunks`: Total chunks in database (all files)

---

## Calculating Chunks Before Upload

### Python Function
```python
def estimate_chunks(file_path, chunk_size=400, overlap=100):
    """Estimate how many chunks a file will create."""

    # Read file
    with open(file_path, 'r') as f:
        text = f.read()

    text_length = len(text)
    step_size = chunk_size - overlap

    # Calculate chunks
    chunks = 1 + max(0, (text_length - chunk_size + step_size - 1) // step_size)

    return chunks, text_length

# Usage
chunks, length = estimate_chunks("sample_documents/project_info.txt")
print(f"File will create {chunks} chunks from {length} characters")
```

---

## Troubleshooting

### Problem: "No chunks showing up"

**Check 1: Is the database initialized?**
```bash
python inspect_db.py
```

**Check 2: Are files uploaded?**
```bash
curl http://localhost:8000/status
```

**Check 3: For pgvector, is PostgreSQL running?**
```bash
psql -U postgres -c "SELECT 1"
```

### Problem: "Fewer chunks than expected"

**Reason 1:** Empty or whitespace-only chunks are skipped
```python
# In document_parsers.py:391
if chunk.strip():  # Only adds non-empty chunks
    chunks.append(chunk.strip())
```

**Reason 2:** File has less text than expected
- PDF might be images, not text
- Excel might have empty cells
- Check extracted text length

**Solution:** Use verbose upload to see extracted text:
```python
# Modify app.py temporarily to print extracted text
print(f"Extracted text length: {len(text)} characters")
```

---

## Summary

**Quick Checks:**
1. **API:** `curl http://localhost:8000/status` (easiest)
2. **Script:** `python inspect_db.py` (most detailed)
3. **Database:** `psql -d rag_db -c "SELECT COUNT(*) FROM rag_documents;"` (direct)

**Chunk Formula:**
```
chunks = ceil(text_length / (chunk_size - overlap))

With defaults (chunk_size=400, overlap=100):
chunks ≈ text_length / 300
```

**Per-File Chunks:**
- Check upload response: `chunks_added` field
- Query database: `GROUP BY metadata->>'filename'`
- Use inspection script: Shows breakdown per document

**Storage:**
```
1 vector = dimensions × 4 bytes

With 1024 dimensions:
1 vector = 4KB
1000 vectors = 4MB
1M vectors = 4GB
```
