# Quick Start Guide - RAG API

Get up and running in 5 minutes!

## Files Created

```
RAG/
├── simple_rag.py                    # ✅ Original (untouched)
├── config.py                        # ✅ NEW - Configuration (swap providers here!)
├── embeddings.py                    # ✅ NEW - Embedding providers
├── vector_databases.py              # ✅ NEW - Vector DB providers
├── document_parsers.py              # ✅ NEW - PDF/DOCX/Excel parsers
├── app.py                           # ✅ NEW - FastAPI server
├── requirements_api.txt             # ✅ NEW - Dependencies
├── API_DOCUMENTATION.md             # ✅ NEW - Complete API docs
├── QUICK_START.md                   # ✅ NEW - This file
└── RAG_IMPLEMENTATION_ALTERNATIVES.md  # Earlier - Provider comparisons
```

---

## Step 1: Install Dependencies (2 minutes)

```bash
# Make sure you're in the RAG directory
cd /home/seetha/Documents/Seetha/RAG

# Install all dependencies
pip install -r requirements_api.txt
```

**Note:** First run downloads embedding model (~90MB), be patient!

---

## Step 2: Verify Configuration (30 seconds)

Your `.env` file should have:
```bash
GEMINI_API_KEY=AIzaSyBX_PTD47I45KyPIdyz4GZ9MIDP0TO3XR4
```

Already configured! ✅

---

## Step 3: Start the Server (10 seconds)

```bash
python app.py
```

You should see:
```
================================================================================
Initializing RAG System...
================================================================================
✓ Embedding model: all-MiniLM-L6-v2 (384 dims)
✓ Vector database: faiss
✓ LLM: gemini-2.5-flash (Gemini)
================================================================================
✓ RAG System Ready!
================================================================================

INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Server is running!** 🚀

---

## Step 4: Test the API (2 minutes)

### Open Interactive Docs

Go to: http://localhost:8000/docs

You'll see Swagger UI with all endpoints!

---

### OR Test with curl

#### Upload a Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/project_info.txt"
```

**Expected:** JSON response with `"status": "success"`

---

#### Query the Knowledge Base

```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3BHK apartment?"}'
```

**Expected:** JSON with answer + sources

---

#### Check Status

```bash
curl http://localhost:8000/status
```

**Expected:**
```json
{
  "status": "running",
  "total_documents": 1,
  "total_chunks": 3,
  "embedding_model": "local/all-MiniLM-L6-v2",
  "vector_db_provider": "faiss",
  "llm_model": "gemini/gemini-2.5-flash"
}
```

---

## Step 5: Upload Your Own Documents

```bash
# Upload PDF
curl -X POST "http://localhost:8000/upload" \
  -F "file=@/path/to/your/document.pdf"

# Upload DOCX
curl -X POST "http://localhost:8000/upload" \
  -F "file=@/path/to/your/document.docx"

# Upload Excel
curl -X POST "http://localhost:8000/upload" \
  -F "file=@/path/to/your/spreadsheet.xlsx"
```

**Supported formats:** PDF, DOCX, XLSX, TXT
**Max size:** 50 MB (configurable)

---

## What You Can Do Now

### ✅ Stream Documents (No Disk Storage)
Upload files directly from memory - no temp files created!

### ✅ Query with AI
Ask questions, get answers with source citations

### ✅ Swap Providers in 3 Lines
Change embeddings, vector DB, or LLM by editing `config.py`

### ✅ Save & Load Vector DB
Persist data between server restarts

### ✅ Production-Ready API
FastAPI with automatic docs, validation, error handling

---

## Swapping Providers (Example)

### Want to try OpenAI instead of Gemini?

**1. Install OpenAI package:**
```bash
pip install openai
```

**2. Add API key to `.env`:**
```bash
OPENAI_API_KEY=your_openai_key_here
```

**3. Edit `config.py` (3 lines):**
```python
LLM_CONFIG = {
    "provider": "openai",  # Changed from "gemini"
    "model": "gpt-3.5-turbo",  # Changed model
    "openai_api_key": os.getenv("OPENAI_API_KEY"),  # Changed key
}
```

**4. Restart server:**
```bash
python app.py
```

**Done!** Now using OpenAI GPT-3.5 instead of Gemini 🎯

---

## Common Commands

```bash
# Start server
python app.py

# Start with auto-reload (development)
uvicorn app:app --reload

# Upload all documents in folder
for file in ./documents/*.pdf; do
  curl -X POST "http://localhost:8000/upload" -F "file=@$file"
done

# Query
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "Your question here"}'

# Status
curl http://localhost:8000/status

# Save vector DB
curl -X POST "http://localhost:8000/save"

# Reset (clear all)
curl -X DELETE "http://localhost:8000/reset"
```

---

## Architecture Highlights

### 🔄 Swappable Components

```python
# config.py - Single source of truth
EMBEDDING_CONFIG = {"provider": "local", ...}  # or "openai", "cohere"
VECTOR_DB_CONFIG = {"provider": "faiss", ...}  # or "pinecone", "weaviate"
LLM_CONFIG = {"provider": "gemini", ...}       # or "openai", "claude"
```

Change providers → Restart → Done! No code changes needed.

---

### 📄 Document Processing Flow

```
User uploads PDF/DOCX/Excel
    ↓
Stream bytes (no disk save)
    ↓
Parse in-memory
    ↓
Chunk text (400 chars, 100 overlap)
    ↓
Generate embeddings
    ↓
Add to vector DB
    ↓
Return success
```

---

### 🔍 Query Flow

```
User asks question
    ↓
Embed query
    ↓
Search vector DB (top-3 chunks)
    ↓
Build context from chunks
    ↓
Send to LLM (Gemini/GPT/Claude)
    ↓
Return answer + sources
```

---

## Provider Options

### Embeddings
- **local** (free): all-MiniLM-L6-v2, all-mpnet-base-v2, e5-large-v2
- **openai** (paid): text-embedding-3-small, text-embedding-3-large
- **cohere** (paid): embed-english-v3.0, embed-multilingual-v3.0

### Vector Databases
- **faiss** (free, local): Fast, simple, for development
- **chromadb** (free, local): Auto-persistence
- **pinecone** (paid, cloud): Production scale
- **weaviate** (paid/self-hosted): Advanced features
- **qdrant** (paid/self-hosted): High performance

### LLMs
- **gemini** (current): Fast, cost-effective
- **openai**: GPT-4, GPT-3.5-turbo
- **claude**: Claude 3.5 Sonnet, Claude Haiku

---

## Cost Comparison (10K queries/month)

| Setup | Cost/Month |
|-------|------------|
| Current (Local + Gemini) | **$2.50** |
| Local + GPT-3.5 | $10-20 |
| Local + GPT-4 | $100-300 |
| OpenAI embeddings + GPT-4 + Pinecone | $170-370 |

---

## Next Steps

1. ✅ **Test with sample documents** (already in `sample_documents/`)
2. ✅ **Upload your real documents**
3. ✅ **Try different queries**
4. ✅ **Experiment with providers** (edit `config.py`)
5. ✅ **Read full docs** (`API_DOCUMENTATION.md`)
6. ✅ **Compare providers** (`RAG_IMPLEMENTATION_ALTERNATIVES.md`)

---

## Troubleshooting

### Server won't start

**Error:** `ModuleNotFoundError`

**Fix:**
```bash
pip install -r requirements_api.txt
```

---

### Upload fails

**Check file size:**
```bash
ls -lh your_file.pdf
```

If > 50 MB, update `config.py`:
```python
DOCUMENT_CONFIG = {
    "max_file_size_mb": 100,  # Increased from 50
}
```

---

### Slow first query

**Normal!** Embedding model downloads on first use (~90MB)

Subsequent queries will be fast.

---

### Empty query results

**Check if documents uploaded:**
```bash
curl http://localhost:8000/status
```

If `total_chunks: 0`, upload documents first.

---

## Summary

You now have:

✅ **Complete RAG API** - FastAPI server with 7 endpoints
✅ **Streaming uploads** - PDF/DOCX/Excel processed in-memory
✅ **Swappable providers** - Change in 3 lines
✅ **Production-ready** - Error handling, validation, docs
✅ **Full documentation** - curl, Postman examples
✅ **Cost-optimized** - Start free, scale as needed

**Your current setup:**
- Embeddings: Local (all-MiniLM-L6-v2) - FREE
- Vector DB: FAISS (local) - FREE
- LLM: Gemini 2.5 Flash - ~$2.50/month

**Total cost: ~$2.50/month** 🎉

---

## Support

- **API Docs:** `API_DOCUMENTATION.md`
- **Code Explanations:** `CODE_EXPLANATION.md`
- **Provider Comparisons:** `RAG_IMPLEMENTATION_ALTERNATIVES.md`
- **Interactive API Docs:** http://localhost:8000/docs

Happy building! 🚀
