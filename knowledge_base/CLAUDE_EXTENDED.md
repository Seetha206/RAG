# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reference Documentation

**Essential reading before making changes:**
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Visual guide to project structure with diagrams and quick commands (READ THIS FIRST!)
- **[project-structure.yaml](project-structure.yaml)** - Complete project structure in YAML format (detailed reference)
- **[VECTOR_DB.md](VECTOR_DB.md)** - Complete comparison of FAISS, ChromaDB, pgvector, Pinecone, Qdrant, Weaviate with benchmarks, use cases, and migration guides
- **[EMBEDDING_MODELS.md](EMBEDDING_MODELS.md)** - Detailed analysis of all embedding models (local and cloud) with quality comparisons, cost analysis, and recommendations
- **[CHECKING_DATABASE.md](CHECKING_DATABASE.md)** - How to inspect the database, understand chunk storage, and calculate vectors per file
- **[RAG_IMPLEMENTATION_ALTERNATIVES.md](RAG_IMPLEMENTATION_ALTERNATIVES.md)** - Cost comparisons and architecture options for different LLM providers

## Project Overview

This is a modular RAG (Retrieval Augmented Generation) system with FastAPI backend. The architecture is designed to be highly configurable - swap embedding models, vector databases, and LLMs by changing `config.py` without touching code.

## Key Architecture

**Plugin-based design with factory patterns:**
- `embeddings.py` - Abstract `EmbeddingProvider` base class with implementations for local (sentence-transformers), OpenAI, and Cohere
- `vector_databases.py` - Abstract `VectorDatabase` base class with implementations for FAISS, ChromaDB, Pinecone, and pgvector
- `document_parsers.py` - Streaming parsers that process files in-memory (no disk storage) for PDF, DOCX, and Excel
- `config.py` - Centralized configuration where all providers are selected
- `app.py` - FastAPI server that wires everything together using factory functions

**Flow:** User uploads document → Streamed as bytes → Parsed in-memory → Chunked → Embedded → Stored in vector DB. On query → Embed query → Semantic search → Retrieve chunks → Generate answer with LLM.

## Development Commands

### Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements_api.txt
```

### Running the Server
```bash
# Development mode (auto-reload enabled)
uvicorn app:app --reload

# Production mode
uvicorn app:app --host 0.0.0.0 --port 8000

# Alternative: run directly
python app.py
```

The API docs will be available at http://localhost:8000/docs (interactive Swagger UI).

### Testing
```bash
# Test simple RAG implementation (no API server)
python simple_rag.py

# Test embedding providers
python embeddings.py

# Test document parsers
python document_parsers.py
```

## Configuration System

All provider switching happens in `config.py`. Never hardcode provider logic in main code.

### Switching Embedding Providers
Edit `EMBEDDING_CONFIG` in config.py:
```python
# Local (free)
{"provider": "local", "model": "BAAI/bge-large-en-v1.5", "dimensions": 1024}

# OpenAI (paid)
{"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}
```

### Switching Vector Databases
Edit `VECTOR_DB_CONFIG` in config.py:
```python
# Local FAISS
{"provider": "faiss"}

# PostgreSQL with pgvector extension
{"provider": "pgvector"}

# Cloud Pinecone
{"provider": "pinecone"}
```

### Switching LLM Providers
Edit `LLM_CONFIG` in config.py:
```python
# Gemini (default, cost-effective)
{"provider": "gemini", "model": "models/gemini-3-flash-preview"}

# OpenAI
{"provider": "openai", "model": "gpt-4-turbo"}

# Claude
{"provider": "claude", "model": "claude-3-5-sonnet-20241022"}
```

## Important Implementation Details

### Document Processing (document_parsers.py)
- All parsers work with `bytes` (streaming), never write to disk
- `auto_detect_and_parse()` is the main entry point - detects file type and routes to appropriate parser
- For PDF: supports PyPDF2 (simple) and pdfplumber (better for tables)
- For Excel: supports pandas (easier) and openpyxl (more control)
- Text chunking uses overlapping windows (default: 400 chars, 100 char overlap)

### Vector Database Abstraction (vector_databases.py)
- All vector DBs implement: `add()`, `search()`, `save()`, `load()`, `reset()`, `get_stats()`
- FAISS: Returns similarity as `1 / (1 + L2_distance)`
- pgvector: Uses cosine similarity `(1 - cosine_distance)`
- Pinecone: Returns native cosine similarity scores
- The factory function `get_vector_database()` reads config and instantiates the right provider

### Embedding Abstraction (embeddings.py)
- All embedders implement: `embed()`, `get_dimensions()`, `get_model_name()`
- `embed()` accepts both single string and List[str], always returns numpy array
- Local models download on first run (~90MB for all-MiniLM-L6-v2, ~1.3GB for BAAI/bge-large)
- The factory function `get_embedding_provider()` reads config and instantiates the right provider

### FastAPI Application (app.py)
- **Global state:** Embedder and vector DB are initialized once at startup
- **No disk storage:** Documents are streamed via `UploadFile`, processed as bytes, never saved
- **Endpoints:**
  - `POST /upload` - Stream document upload, parse, embed, store
  - `POST /query` - Query with RAG (embed query, search, generate answer)
  - `GET /status` - System stats (document count, vector count, providers)
  - `DELETE /reset` - Clear all vectors
  - `POST /save` - Persist vector DB (FAISS only; others auto-persist)
  - `POST /load` - Load vector DB (FAISS only; others auto-load)

## Adding New Providers

### New Embedding Provider
1. Create class in `embeddings.py` inheriting from `EmbeddingProvider`
2. Implement: `embed()`, `get_dimensions()`, `get_model_name()`
3. Add to `get_embedding_provider()` factory function
4. Add config example to `config.py`

### New Vector Database
1. Create class in `vector_databases.py` inheriting from `VectorDatabase`
2. Implement all abstract methods (add, search, save, load, reset, get_stats)
3. Add to `get_vector_database()` factory function
4. Add config section to `config.py`

### New Document Parser
1. Add parser function to `document_parsers.py` (signature: `bytes -> str`)
2. Add file extension detection to `auto_detect_and_parse()`
3. Update `DOCUMENT_CONFIG["supported_formats"]` in `config.py`

## Environment Variables

Required in `.env`:
```bash
# At minimum, one LLM provider API key:
GEMINI_API_KEY=your_key_here

# Optional (if using these providers):
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
COHERE_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
PINECONE_ENV=us-east-1

# PostgreSQL connection (if using pgvector):
PGVECTOR_CONNECTION_STRING=postgresql://user:password@localhost:5432/rag_db
```

## PostgreSQL pgvector Setup

When using pgvector, the database setup is automatic in `vector_databases.py:_setup_database()`:
1. Creates vector extension
2. Creates table with vector column
3. Creates IVFFlat index for fast similarity search

Manual setup (if needed):
```sql
CREATE EXTENSION vector;
CREATE TABLE rag_documents (
    id TEXT PRIMARY KEY,
    embedding vector(1024),  -- Match your embedding dimensions
    text TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## RAG Configuration Tuning

In `config.py`, adjust `RAG_CONFIG`:
- `chunk_size` - Larger chunks = more context but less precise retrieval (default: 400)
- `chunk_overlap` - Prevents splitting related info across chunks (default: 100)
- `top_k` - More chunks = more context but slower and noisier (default: 3)
- `system_prompt` - Controls how LLM uses retrieved context

## Common Pitfalls

1. **Dimension mismatch:** Embedding dimensions must match between `EMBEDDING_CONFIG["dimensions"]` and the vector DB dimension parameter
2. **Missing API keys:** LLM provider needs corresponding API key in `.env`
3. **pgvector connection:** Ensure PostgreSQL is running and vector extension is installed before using pgvector
4. **File size limits:** Default max is 50MB per file (configurable in `DOCUMENT_CONFIG["max_file_size_mb"]`)
5. **Provider imports:** Cloud providers (OpenAI, Pinecone, etc.) are commented out in `requirements_api.txt` - uncomment as needed

## Code Style

- Abstract base classes define interfaces, concrete classes implement providers
- Factory functions (`get_*()`) centralize provider instantiation
- All file I/O uses `bytes` and streams (no temp files)
- Configuration over code - change behavior via `config.py`, not code edits
- Each module is independently testable (has `if __name__ == "__main__"` block)
