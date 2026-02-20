# Project Structure Overview

This document provides a visual and detailed explanation of the RAG project structure.

## Directory Tree

```
RAG/
├── 📄 Core Application Files
│   ├── app.py                          # FastAPI server (main application)
│   ├── config.py                       # Configuration (single source of truth)
│   ├── embeddings.py                   # Embedding provider abstraction
│   ├── vector_databases.py             # Vector database abstraction
│   ├── document_parsers.py             # Document parsing utilities
│   ├── simple_rag.py                   # Standalone RAG demo
│   ├── inspect_db.py                   # Database inspection utility
│   ├── inspect_faiss.py                # FAISS-specific inspection
│   └── pinecone_rag.py                 # Pinecone integration example
│
├── 📚 Documentation
│   ├── CLAUDE.md                       # Main guide for AI assistants
│   ├── project-structure.yaml          # Complete project structure (YAML)
│   ├── PROJECT_STRUCTURE.md            # This file (visual guide)
│   ├── VECTOR_DB.md                    # Vector database comparison
│   ├── EMBEDDING_MODELS.md             # Embedding models guide
│   ├── CHECKING_DATABASE.md            # Database inspection guide
│   ├── RAG_IMPLEMENTATION_ALTERNATIVES.md  # Cost & architecture options
│   ├── README_SIMPLE_RAG.md            # Getting started guide
│   ├── QUICK_START.md                  # Quick setup
│   ├── NEW_SETUP_GUIDE.md              # Comprehensive setup
│   ├── PGVECTOR_SETUP.md               # PostgreSQL setup
│   ├── API_DOCUMENTATION.md            # API reference
│   ├── CODE_EXPLANATION.md             # Code details
│   ├── TECHNICAL_DEEP_DIVE.md          # Architecture deep dive
│   ├── RAG_DEEP_DIVE.md                # RAG concepts
│   └── GEMINI.md                       # Gemini-specific notes
│
├── 🗂️ Configuration
│   ├── .env                            # Environment variables (secrets) [GITIGNORE]
│   ├── .env.example                    # Template for .env
│   ├── requirements.txt                # Simple RAG dependencies
│   └── requirements_api.txt            # Full API dependencies
│
├── 📁 Data Directories
│   ├── sample_documents/               # Sample files for testing
│   │   ├── project_info.txt           # Real estate project info
│   │   ├── amenities.txt              # Amenities list
│   │   └── faq.txt                    # FAQs
│   │
│   └── vector_store/                   # Vector DB persistence [GITIGNORE]
│       ├── faiss.index                # FAISS index file
│       ├── faiss_metadata.json        # FAISS metadata
│       └── chromadb/                  # ChromaDB persistence
│
├── 🎨 Frontend (Placeholder)
│   └── frontend/
│       └── README.md                   # Frontend placeholder
│
├── 📦 Archive
│   └── RAG/                            # Old implementations
│       ├── simple_rag.py              # Earlier version
│       ├── inspect_faiss.py           # Old inspector
│       ├── RAG_Implementation_Guide.md
│       ├── backend_use_cases.md
│       └── Simple RAG Learning Implementation.txt
│
└── 🔧 Virtual Environment
    └── venv/                           # Python virtual environment [GITIGNORE]
```

## File Categories

### 🎯 Core Python Modules (Start Here)

| File | Lines | Purpose | Run With |
|------|-------|---------|----------|
| **app.py** | 484 | FastAPI server with all endpoints | `uvicorn app:app --reload` |
| **config.py** | 207 | Configuration hub (change providers here) | Imported by others |
| **embeddings.py** | 319 | Embedding provider abstraction (local, OpenAI, Cohere) | Imported by app.py |
| **vector_databases.py** | 724 | Vector DB abstraction (FAISS, ChromaDB, pgvector, Pinecone) | Imported by app.py |
| **document_parsers.py** | 417 | Parse PDF, DOCX, Excel, TXT (streaming, no disk) | Imported by app.py |
| **simple_rag.py** | ~200 | Standalone RAG demo (no API) | `python simple_rag.py` |
| **inspect_db.py** | ~300 | Inspect database contents | `python inspect_db.py` |

### 📖 Documentation (Read These)

#### Essential Reading
1. **CLAUDE.md** - Start here! Main guide for understanding the project
2. **project-structure.yaml** - Complete project structure in YAML format
3. **PROJECT_STRUCTURE.md** - This file (visual guide)

#### Technical Guides
- **VECTOR_DB.md** - Which vector database to use? FAISS vs ChromaDB vs pgvector vs Pinecone
- **EMBEDDING_MODELS.md** - Which embedding model? 10 models compared with benchmarks
- **CHECKING_DATABASE.md** - How to check chunks, calculate storage, inspect data
- **RAG_IMPLEMENTATION_ALTERNATIVES.md** - OpenAI vs Claude vs Gemini cost comparison

#### Setup Guides
- **README_SIMPLE_RAG.md** - Quick start for beginners
- **QUICK_START.md** - Fast setup
- **NEW_SETUP_GUIDE.md** - Comprehensive setup
- **PGVECTOR_SETUP.md** - PostgreSQL + pgvector setup

#### Reference
- **API_DOCUMENTATION.md** - API endpoints reference
- **CODE_EXPLANATION.md** - Code walkthrough
- **TECHNICAL_DEEP_DIVE.md** - Architecture details
- **RAG_DEEP_DIVE.md** - RAG concepts explained

### ⚙️ Configuration Files

| File | Purpose | Commit to Git? |
|------|---------|----------------|
| **.env** | API keys and secrets | ❌ NO (gitignore) |
| **.env.example** | Template for .env | ✅ Yes |
| **requirements.txt** | Simple RAG dependencies | ✅ Yes |
| **requirements_api.txt** | Full API dependencies | ✅ Yes |

### 📁 Data Directories

#### sample_documents/
Sample files for testing the RAG system:
- **project_info.txt** (952 bytes) → ~3-4 chunks
- **amenities.txt** (1169 bytes) → ~4-5 chunks
- **faq.txt** (1810 bytes) → ~6-7 chunks

#### vector_store/ [Auto-created, gitignored]
Persistent storage for vector databases:
- **faiss.index** - FAISS vector index (binary)
- **faiss_metadata.json** - Chunk metadata (JSON)
- **chromadb/** - ChromaDB persistence directory

## Architecture Overview

### Design Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                      Configuration                          │
│                      (config.py)                            │
│  - EMBEDDING_CONFIG                                         │
│  - VECTOR_DB_CONFIG                                         │
│  - LLM_CONFIG                                               │
│  - RAG_CONFIG                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Server                           │
│                     (app.py)                                │
│                                                             │
│  Endpoints:                                                 │
│  • POST /upload    - Upload documents                       │
│  • POST /query     - Query with RAG                         │
│  • GET  /status    - System stats                           │
│  • DELETE /reset   - Clear database                         │
└──────┬──────────────┬───────────────┬──────────────────────┘
       │              │               │
       ▼              ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│  Embeddings │ │  Vector DB  │ │   Document   │
│  Provider   │ │  Provider   │ │   Parsers    │
│             │ │             │ │              │
│ • Local     │ │ • FAISS     │ │ • PDF        │
│ • OpenAI    │ │ • ChromaDB  │ │ • DOCX       │
│ • Cohere    │ │ • pgvector  │ │ • Excel      │
│             │ │ • Pinecone  │ │ • TXT        │
└─────────────┘ └─────────────┘ └──────────────┘
```

### Data Flow

#### Document Upload Flow
```
User uploads file.pdf
        ↓
FastAPI receives UploadFile (streaming)
        ↓
file.read() → bytes (in-memory, no disk)
        ↓
auto_detect_and_parse() → extracted text
        ↓
chunk_text() → ["chunk1", "chunk2", "chunk3"]
        ↓
embedder.embed() → [[0.1, 0.2, ...], [0.3, 0.4, ...], ...]
        ↓
vector_db.add() → stores vectors + metadata
        ↓
Response: {chunks_added: 3, total_chunks: 150}
```

#### Query Flow
```
User sends: "What is the price of 3BHK?"
        ↓
embedder.embed(query) → [0.5, 0.6, 0.7, ...]
        ↓
vector_db.search(embedding, top_k=3) → [chunk1, chunk2, chunk3]
        ↓
generate_answer(chunks, query)
        ↓
LLM (Gemini/OpenAI/Claude) → "The price is Rs 95 lakhs"
        ↓
Response: {answer: "...", sources: [...]}
```

### Factory Pattern

All providers use factory pattern for easy swapping:

```python
# embeddings.py
def get_embedding_provider(config):
    if config["provider"] == "local":
        return LocalEmbeddings(config["model"])
    elif config["provider"] == "openai":
        return OpenAIEmbeddings(config["model"], config["api_key"])
    # ...

# vector_databases.py
def get_vector_database(config, dimensions):
    if config["provider"] == "faiss":
        return FAISSDatabase(dimensions)
    elif config["provider"] == "pgvector":
        return PgVectorDatabase(config["connection_string"])
    # ...
```

**Result:** Change provider by editing `config.py`, no code changes needed!

## Current Configuration

### As of 2026-02-02

```yaml
Embedding Model:
  Provider: local (sentence-transformers)
  Model: BAAI/bge-large-en-v1.5
  Dimensions: 1024
  Cost: Free
  Quality: Excellent (88% MTEB score)

Vector Database:
  Provider: pgvector
  Backend: PostgreSQL with vector extension
  Connection: postgresql://localhost:5432/rag_db
  Table: rag_documents
  Cost: Free (self-hosted)

LLM:
  Provider: gemini
  Model: models/gemini-3-flash-preview
  Cost: ~$2.50/month

RAG Settings:
  Chunk Size: 400 characters
  Chunk Overlap: 100 characters
  Top-K Results: 3

Total Cost: ~$2.50-10/month
```

## Quick Start Commands

### First Time Setup
```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements_api.txt

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Start server
uvicorn app:app --reload

# 5. Visit API docs
open http://localhost:8000/docs
```

### Daily Development
```bash
# Activate environment
source venv/bin/activate

# Start server
uvicorn app:app --reload

# In another terminal: Test simple RAG
python simple_rag.py

# Check database
python inspect_db.py

# Check API status
curl http://localhost:8000/status
```

### Testing Endpoints
```bash
# Upload a document
curl -X POST http://localhost:8000/upload \
  -F "file=@sample_documents/project_info.txt"

# Query the knowledge base
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3BHK?"}'

# Get system status
curl http://localhost:8000/status

# Reset database
curl -X DELETE http://localhost:8000/reset
```

## Key Concepts

### What is a Chunk?

A **chunk** is a piece of text split from a document. Each chunk becomes one **vector** in the database.

```
Document: "Green Valley Residences is a premium residential project..."
(1000 characters)
        ↓ (chunk_size=400, overlap=100)
Chunk 1: chars 0-400    → Vector 1
Chunk 2: chars 300-700  → Vector 2  (overlaps with chunk 1)
Chunk 3: chars 600-1000 → Vector 3  (overlaps with chunk 2)

Result: 3 vectors stored in database
```

**Why overlap?** Prevents splitting related information across chunks.

### Chunk Calculation

```python
# Formula
step_size = chunk_size - overlap = 400 - 100 = 300
chunks = ceil(text_length / step_size)

# Example
text_length = 1500 characters
chunks = ceil(1500 / 300) = 5 chunks
```

### Storage Calculation

```python
# With 1024-dimensional embeddings
bytes_per_vector = 1024 × 4 bytes (float32) = 4,096 bytes = 4KB

# Example
100 chunks × 4KB = 400KB
1,000 chunks × 4KB = 4MB
1,000,000 chunks × 4KB = 4GB
```

## Common Tasks

### Switching Providers

All done via `config.py`:

```python
# Switch from local to OpenAI embeddings
EMBEDDING_CONFIG = {
    "provider": "openai",  # Changed from "local"
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "api_key": os.getenv("OPENAI_API_KEY"),
}

# Switch from pgvector to FAISS
VECTOR_DB_CONFIG = {
    "provider": "faiss",  # Changed from "pgvector"
}

# Switch from Gemini to Claude
LLM_CONFIG = {
    "provider": "claude",  # Changed from "gemini"
    "model": "claude-3-5-sonnet-20241022",
    "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY"),
}
```

**No code changes needed!** Just restart the server.

### Checking Database Contents

```bash
# Method 1: API (if server running)
curl http://localhost:8000/status

# Method 2: Inspection script (most detailed)
python inspect_db.py

# Method 3: Direct SQL (pgvector only)
psql -d rag_db -c "SELECT COUNT(*) FROM rag_documents;"
```

### Monitoring Uploads

```bash
# Terminal 1: Watch status
watch -n 1 'curl -s http://localhost:8000/status'

# Terminal 2: Upload files
curl -X POST http://localhost:8000/upload \
  -F "file=@your_file.pdf"

# Watch chunks increase in real-time!
```

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **"No module named 'sentence_transformers'"** | `pip install -r requirements_api.txt` |
| **"GEMINI_API_KEY not found"** | Check `.env` file exists and has key |
| **"Connection refused" (pgvector)** | Start PostgreSQL: `sudo systemctl start postgresql` |
| **"No chunks showing up"** | Run `python inspect_db.py` to debug |
| **Server won't start** | Check port 8000 is free: `lsof -i :8000` |

### Debug Steps

1. **Check configuration:**
   ```bash
   cat config.py | grep "provider"
   ```

2. **Verify environment:**
   ```bash
   cat .env | grep API_KEY
   ```

3. **Test database connection:**
   ```bash
   python inspect_db.py
   ```

4. **Check server logs:**
   ```bash
   uvicorn app:app --reload --log-level debug
   ```

## File Size Guide

| File | Size | Purpose |
|------|------|---------|
| **app.py** | 15 KB | Main application |
| **embeddings.py** | 10 KB | Embedding providers |
| **vector_databases.py** | 24 KB | Vector DB providers |
| **document_parsers.py** | 12 KB | Document parsing |
| **config.py** | 7 KB | Configuration |
| **VECTOR_DB.md** | 45 KB | Documentation |
| **EMBEDDING_MODELS.md** | 60 KB | Documentation |
| **project-structure.yaml** | 20 KB | This structure |

## Dependencies

### Core (Always Required)
- **FastAPI** - Web framework
- **uvicorn** - ASGI server
- **sentence-transformers** - Local embeddings
- **numpy** - Numerical operations
- **python-dotenv** - Environment variables

### Document Parsing
- **PyPDF2** - PDF parsing
- **python-docx** - DOCX parsing
- **openpyxl** - Excel parsing
- **pandas** - Data manipulation

### Vector Databases (Install as needed)
- **faiss-cpu** - FAISS (always installed)
- **chromadb** - ChromaDB (optional)
- **psycopg2-binary** - pgvector (optional)
- **pinecone-client** - Pinecone (optional)

### LLM Providers (Install as needed)
- **google-genai** - Gemini (default)
- **openai** - GPT-4/3.5 (optional)
- **anthropic** - Claude (optional)

### Embedding Providers (Install as needed)
- **openai** - OpenAI embeddings (optional)
- **cohere** - Cohere embeddings (optional)

## Next Steps

1. **Explore the code:**
   - Start with `config.py` to understand configuration
   - Read `app.py` to see how everything connects
   - Check `embeddings.py` and `vector_databases.py` for abstractions

2. **Read documentation:**
   - `CLAUDE.md` - Overview and best practices
   - `VECTOR_DB.md` - Choose your vector database
   - `EMBEDDING_MODELS.md` - Choose your embedding model

3. **Try it out:**
   - Run `python simple_rag.py` for a simple demo
   - Start the API server: `uvicorn app:app --reload`
   - Upload documents via `/upload` endpoint
   - Query via `/query` endpoint

4. **Customize:**
   - Edit `config.py` to change providers
   - Modify `RAG_CONFIG` to tune chunk size
   - Add your own documents to test

## Summary

**This project is:**
- ✅ Modular (swap components via config)
- ✅ Production-ready (pgvector, FastAPI)
- ✅ Well-documented (10+ MD files)
- ✅ Cost-effective ($2.50-10/month)
- ✅ Privacy-focused (local embeddings)

**Key files to know:**
1. `config.py` - Change everything here
2. `app.py` - Main application logic
3. `CLAUDE.md` - Read this first
4. `inspect_db.py` - Check your database

**Quick commands:**
```bash
uvicorn app:app --reload       # Start server
python simple_rag.py           # Simple demo
python inspect_db.py           # Check database
curl localhost:8000/status     # API status
```

Happy coding! 🚀
