# RAG API Documentation

Complete guide to using the RAG API with curl and Postman examples.

## Table of Contents
1. [Quick Start](#quick-start)
2. [API Endpoints](#api-endpoints)
3. [curl Examples](#curl-examples)
4. [Postman Examples](#postman-examples)
5. [Response Examples](#response-examples)
6. [Error Handling](#error-handling)
7. [Configuration](#configuration)

---

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements_api.txt
```

### 2. Configure API Keys
Create/update `.env` file:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
# Optional: Add if using other providers
# OPENAI_API_KEY=your_openai_key
# ANTHROPIC_API_KEY=your_claude_key
# PINECONE_API_KEY=your_pinecone_key
```

### 3. Start Server
```bash
python app.py
```

Or with uvicorn directly:
```bash
uvicorn app:app --reload --port 8000
```

### 4. Access Interactive Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | API information |
| POST | /upload | Upload document (PDF, DOCX, Excel) |
| POST | /query | Query the knowledge base |
| GET | /status | Get system status |
| DELETE | /reset | Clear vector database |
| POST | /save | Save vector DB to disk |
| POST | /load | Load vector DB from disk |

---

## curl Examples

### 1. Root Endpoint (API Info)

```bash
curl http://localhost:8000/
```

**Response:**
```json
{
  "name": "RAG API Server",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {...}
}
```

---

### 2. Upload PDF Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/document.pdf"
```

**Example with real file:**
```bash
# Upload from sample_documents folder
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/project_info.txt"
```

**Response:**
```json
{
  "status": "success",
  "message": "Document processed successfully",
  "document_id": "doc_1_1704067200",
  "filename": "project_info.txt",
  "file_info": {
    "filename": "project_info.txt",
    "extension": "txt",
    "size_bytes": 952,
    "size_mb": 0.0
  },
  "chunks_added": 3,
  "total_chunks": 3,
  "processing_time_ms": 245.67
}
```

---

### 3. Upload DOCX Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/document.docx"
```

---

### 4. Upload Excel Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/spreadsheet.xlsx"
```

---

### 5. Query the Knowledge Base

```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the price of 3BHK apartment?",
    "top_k": 3
  }'
```

**Simplified (without top_k):**
```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3BHK apartment?"}'
```

**Response:**
```json
{
  "question": "What is the price of 3BHK apartment?",
  "answer": "The price of a 3BHK apartment in Green Valley Residences starts at Rs 95 lakhs.",
  "sources": [
    {
      "text": "Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK, and Rs 1.3 crores for 4BHK apartments. Special launch offers available...",
      "filename": "project_info.txt",
      "chunk_index": 1,
      "similarity_score": 0.856
    },
    {
      "text": "Q: What is the payment plan? A: We offer flexible payment plans with options for construction-linked payments and bank loan assistance...",
      "filename": "faq.txt",
      "chunk_index": 0,
      "similarity_score": 0.742
    }
  ],
  "processing_time_ms": 1234.56
}
```

---

### 6. Get System Status

```bash
curl http://localhost:8000/status
```

**Response:**
```json
{
  "status": "running",
  "total_documents": 3,
  "total_chunks": 15,
  "embedding_model": "local/all-MiniLM-L6-v2",
  "vector_db_provider": "faiss",
  "llm_model": "gemini/gemini-2.5-flash"
}
```

---

### 7. Save Vector Database to Disk

```bash
curl -X POST "http://localhost:8000/save"
```

**Response:**
```json
{
  "status": "success",
  "message": "Database saved to ./vector_store/faiss.index",
  "path": "./vector_store/faiss.index"
}
```

---

### 8. Load Vector Database from Disk

```bash
curl -X POST "http://localhost:8000/load"
```

**Response:**
```json
{
  "status": "success",
  "message": "Database loaded from ./vector_store/faiss.index",
  "total_vectors": 15
}
```

---

### 9. Reset Vector Database

```bash
curl -X DELETE "http://localhost:8000/reset"
```

**Response:**
```json
{
  "status": "success",
  "message": "Vector database reset successfully",
  "total_documents": 0,
  "total_chunks": 0
}
```

---

## Postman Examples

### Setup Postman Collection

#### 1. Upload Document Endpoint

**Method:** POST
**URL:** `http://localhost:8000/upload`
**Headers:**
- Content-Type: `multipart/form-data` (auto-set)

**Body:**
- Type: `form-data`
- Key: `file` (type: File)
- Value: Select your PDF/DOCX/Excel file

**Screenshot Guide:**
```
1. Open Postman
2. Create new request
3. Set method to POST
4. Enter URL: http://localhost:8000/upload
5. Go to "Body" tab
6. Select "form-data"
7. In key field, enter: file
8. Change type from "Text" to "File" (dropdown on right)
9. Click "Select Files" and choose your document
10. Click "Send"
```

---

#### 2. Query Endpoint

**Method:** POST
**URL:** `http://localhost:8000/query`
**Headers:**
- Content-Type: `application/json`

**Body (raw JSON):**
```json
{
  "question": "What is the price of 3BHK apartment?",
  "top_k": 3
}
```

**Screenshot Guide:**
```
1. Create new request
2. Set method to POST
3. Enter URL: http://localhost:8000/query
4. Go to "Body" tab
5. Select "raw"
6. Change dropdown from "Text" to "JSON"
7. Paste the JSON body
8. Click "Send"
```

---

#### 3. Status Endpoint

**Method:** GET
**URL:** `http://localhost:8000/status`
**Headers:** None required

**Screenshot Guide:**
```
1. Create new request
2. Set method to GET
3. Enter URL: http://localhost:8000/status
4. Click "Send"
```

---

#### 4. Reset Endpoint

**Method:** DELETE
**URL:** `http://localhost:8000/reset`
**Headers:** None required

---

### Postman Collection JSON

Save this as `RAG_API.postman_collection.json`:

```json
{
  "info": {
    "name": "RAG API Collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Upload Document",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "/path/to/your/document.pdf"
            }
          ]
        },
        "url": {
          "raw": "http://localhost:8000/upload",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8000",
          "path": ["upload"]
        }
      }
    },
    {
      "name": "Query",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"question\": \"What is the price of 3BHK apartment?\",\n  \"top_k\": 3\n}"
        },
        "url": {
          "raw": "http://localhost:8000/query",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8000",
          "path": ["query"]
        }
      }
    },
    {
      "name": "Status",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:8000/status",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8000",
          "path": ["status"]
        }
      }
    },
    {
      "name": "Reset",
      "request": {
        "method": "DELETE",
        "url": {
          "raw": "http://localhost:8000/reset",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8000",
          "path": ["reset"]
        }
      }
    }
  ]
}
```

**To import:**
1. Open Postman
2. Click "Import" button
3. Select the JSON file
4. Collection will be imported with all requests

---

## Response Examples

### Successful Upload Response

```json
{
  "status": "success",
  "message": "Document processed successfully",
  "document_id": "doc_1_1704067200",
  "filename": "real_estate_guide.pdf",
  "file_info": {
    "filename": "real_estate_guide.pdf",
    "extension": "pdf",
    "size_bytes": 2457600,
    "size_mb": 2.34
  },
  "chunks_added": 25,
  "total_chunks": 25,
  "processing_time_ms": 3456.78
}
```

---

### Successful Query Response

```json
{
  "question": "What amenities are available?",
  "answer": "The project offers comprehensive amenities including a swimming pool, gymnasium, children's play area, landscaped gardens, clubhouse, 24/7 security with CCTV surveillance, power backup, rainwater harvesting, and covered parking.",
  "sources": [
    {
      "text": "Amenities: Swimming pool, Gymnasium, Children's play area, Landscaped gardens, Clubhouse, 24/7 security with CCTV, Power backup, Rainwater harvesting, Covered parking...",
      "filename": "amenities.txt",
      "chunk_index": 0,
      "similarity_score": 0.923
    },
    {
      "text": "The clubhouse features a state-of-the-art gym, indoor games room, library, and party hall. Outdoor amenities include jogging track, yoga deck...",
      "filename": "amenities.txt",
      "chunk_index": 1,
      "similarity_score": 0.867
    }
  ],
  "processing_time_ms": 1567.23
}
```

---

### Status Response

```json
{
  "status": "running",
  "total_documents": 5,
  "total_chunks": 47,
  "embedding_model": "local/all-MiniLM-L6-v2",
  "vector_db_provider": "faiss",
  "llm_model": "gemini/gemini-2.5-flash"
}
```

---

## Error Handling

### 400 - Bad Request

**Unsupported file type:**
```json
{
  "detail": "Unsupported file type: .mp4. Supported: ['.pdf', '.docx', '.xlsx', '.txt']"
}
```

**Empty query:**
```json
{
  "detail": "Question cannot be empty"
}
```

**No documents uploaded:**
```json
{
  "detail": "No documents in knowledge base. Please upload documents first."
}
```

---

### 413 - File Too Large

```json
{
  "detail": "File too large. Max size: 50 MB"
}
```

**Solution:** Reduce file size or update `max_file_size_mb` in `config.py`

---

### 500 - Internal Server Error

```json
{
  "detail": "Processing error: [specific error message]"
}
```

**Common causes:**
- Corrupted document file
- Missing API key in .env
- Embedding model not downloaded yet (first run)

---

## Configuration

### Change Embedding Model

Edit `config.py`:
```python
EMBEDDING_CONFIG = {
    "provider": "openai",  # Changed from "local"
    "model": "text-embedding-3-small",  # Changed model
    "dimensions": 1536,  # Changed dimensions
    "api_key": os.getenv("OPENAI_API_KEY"),
}
```

**Install dependency:**
```bash
pip install openai
```

**Restart server:**
```bash
python app.py
```

---

### Change Vector Database

Edit `config.py`:
```python
VECTOR_DB_CONFIG = {
    "provider": "pinecone",  # Changed from "faiss"
    "pinecone": {
        "api_key": os.getenv("PINECONE_API_KEY"),
        "environment": "us-east-1",
        "index_name": "sellbot-rag",
    },
}
```

**Install dependency:**
```bash
pip install pinecone-client
```

**Restart server.**

---

### Change LLM

Edit `config.py`:
```python
LLM_CONFIG = {
    "provider": "openai",  # Changed from "gemini"
    "model": "gpt-4-turbo",  # Changed model
    "openai_api_key": os.getenv("OPENAI_API_KEY"),
}
```

**Install dependency:**
```bash
pip install openai
```

**Restart server.**

---

## Testing Workflow

### Complete Test Flow

```bash
# 1. Start server
python app.py

# 2. Check status (should show 0 documents)
curl http://localhost:8000/status

# 3. Upload first document
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/project_info.txt"

# 4. Upload second document
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/amenities.txt"

# 5. Upload third document
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/faq.txt"

# 6. Check status (should show 3 documents, ~15 chunks)
curl http://localhost:8000/status

# 7. Test query 1
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3BHK apartment?"}'

# 8. Test query 2
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What amenities are available?"}'

# 9. Save vector database
curl -X POST "http://localhost:8000/save"

# 10. Reset (clear all)
curl -X DELETE "http://localhost:8000/reset"

# 11. Check status (should show 0)
curl http://localhost:8000/status

# 12. Load from disk
curl -X POST "http://localhost:8000/load"

# 13. Check status (should show 3 documents again)
curl http://localhost:8000/status

# 14. Query again (should work with loaded data)
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "Is there a swimming pool?"}'
```

---

## Advanced Usage

### Upload Multiple Documents in Batch

```bash
#!/bin/bash
# upload_all.sh

for file in ./documents/*.pdf; do
  echo "Uploading: $file"
  curl -X POST "http://localhost:8000/upload" \
    -F "file=@$file"
  echo -e "\n---\n"
done
```

**Run:**
```bash
chmod +x upload_all.sh
./upload_all.sh
```

---

### Query with Variable top_k

```bash
# Get top 5 results instead of default 3
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the payment plan?",
    "top_k": 5
  }'
```

---

### Monitor Processing Time

```bash
# Query and extract processing time
curl -s -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the location?"}' \
  | jq '.processing_time_ms'
```

---

## Troubleshooting

### Server won't start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
pip install -r requirements_api.txt
```

---

### Upload fails silently

**Check file size:**
```bash
ls -lh your_file.pdf
```

If > 50 MB, reduce size or update config.

---

### Query returns empty

**Check if documents uploaded:**
```bash
curl http://localhost:8000/status
```

If `total_chunks: 0`, upload documents first.

---

### Slow first query

**Reason:** Embedding model loads on first use (~90MB download)

**Solution:** Wait for first query, subsequent queries will be fast.

---

## Production Deployment

### Using Gunicorn (Production server)

```bash
pip install gunicorn

gunicorn app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

---

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build and run:**
```bash
docker build -t rag-api .
docker run -p 8000:8000 --env-file .env rag-api
```

---

## Summary

You now have:
- ✅ Complete REST API for RAG
- ✅ Document upload (PDF, DOCX, Excel, TXT)
- ✅ Streaming processing (no disk storage)
- ✅ Query with source citations
- ✅ Swappable providers (3-line config change)
- ✅ Full curl and Postman examples
- ✅ Persistence (save/load)

**Next steps:**
1. Upload your documents
2. Test queries
3. Swap providers in `config.py` to compare
4. Deploy to production
