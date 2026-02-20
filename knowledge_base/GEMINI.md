# Gemini Context: RAG API Server

This `GEMINI.md` file provides context for the Gemini AI CLI to understand the structure, purpose, and usage of this project.

## Project Overview

This is a **Retrieval Augmented Generation (RAG) API** built with **Python** and **FastAPI**. It enables users to upload documents (PDF, DOCX, Excel, TXT), process them into vector embeddings, and perform semantic queries using Large Language Models (LLMs) like **Google Gemini**.

The system is designed to be highly modular, allowing easy swapping of components:
*   **LLM Providers:** Google Gemini (default), OpenAI, Anthropic Claude.
*   **Embedding Models:** Local (SentenceTransformers), OpenAI, Cohere.
*   **Vector Databases:** FAISS (default), ChromaDB, Pinecone, Weaviate, Qdrant.

## Key Files & Structure

### Core Application
*   **`app.py`**: The main entry point for the FastAPI server. Handles streaming file uploads and query processing.
*   **`simple_rag.py`**: A standalone, minimal RAG implementation (~200 lines) for learning/testing core concepts without the API layer.
*   **`pinecone_rag.py`**: A standalone script demonstrating RAG with Pinecone vector database and local embeddings.
*   **`inspect_faiss.py`**: Utility script to inspect the contents and metadata of the local FAISS index (`knowledge_base.index`).
*   **`config.py`**: Centralized configuration. **Crucial:** Modify this file to swap providers (e.g., switch from Gemini to OpenAI) without changing code.

### Configuration & Dependencies
*   **`requirements_api.txt`**: Dependencies for the full API server.
*   **`requirements.txt`**: Dependencies for the minimal `simple_rag.py`.
*   **`.env`**: Stores API keys and secrets (use `.env.example` as a template).

### Documentation & Guides
*   **`API_DOCUMENTATION.md`**: Detailed API endpoint documentation.
*   **`QUICK_START.md`**: User-friendly setup and usage guide.
*   **`NEW_SETUP_GUIDE.md`**: Updated step-by-step setup instructions.
*   **`TECHNICAL_DEEP_DIVE.md`**: In-depth explanation of licenses, model loading, and architecture.
*   **`PGVECTOR_SETUP.md`**: Guide for setting up PostgreSQL with pgvector.
*   **`RAG_DEEP_DIVE.md`**: Conceptual guide to Retrieval Augmented Generation.
*   **`CODE_EXPLANATION.md`**: Detailed walkthrough of the code logic.

### Data
*   **`sample_documents/`**: Directory containing example text files for testing.
*   **`knowledge_base.index`**: The default local FAISS vector index file.

## Building and Running

### 1. Environment Setup

The project uses `pip` for dependency management.

```bash
# For the full API server (Recommended)
pip install -r requirements_api.txt

# For the minimal standalone script only
pip install -r requirements.txt
```

### 2. Configuration

*   **Environment Variables:** Secrets (API keys) are managed in a `.env` file.
    *   Required: `GEMINI_API_KEY` (for default setup).
    *   Template: `.env.example`.
*   **App Config:** `config.py` controls model selection, chunk sizes, and system prompts.

### 3. Running the Application

**Start the API Server:**
```bash
python app.py
# OR
uvicorn app:app --reload
```
*   Server runs at: `http://localhost:8000`
*   Interactive Docs: `http://localhost:8000/docs`

**Run Minimal RAG Script:**
```bash
python simple_rag.py
```

## Development Conventions

*   **Modular Architecture:** The project separates concerns into `embeddings.py`, `vector_databases.py`, and `document_parsers.py`. When adding features, respect this separation.
*   **Configuration:** Do not hardcode parameters. Use `config.py` for tunable settings (chunk size, model names) and `.env` for secrets.
*   **In-Memory Processing:** The `app.py` is designed to process uploads in-memory (streaming) to avoid disk clutter, though vector stores (like FAISS) may persist indices to disk.
*   **Error Handling:** The API uses `HTTPException` for standardized error responses.
*   **Documentation:** Updates to the API should be reflected in `API_DOCUMENTATION.md`.

## Common Tasks

*   **Swap LLM:** Edit `LLM_CONFIG` in `config.py`.
*   **Swap Vector DB:** Edit `VECTOR_DB_CONFIG` in `config.py`.
*   **Test Query:**
    ```bash
    curl -X POST "http://localhost:8000/query" \
      -H "Content-Type: application/json" \
      -d '{"question": "What is the price?"}'
    ```
