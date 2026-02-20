# SellBot System Architecture

> **Master architecture document for SellBot -- an AI-powered real estate Sales Operating System.**
>
> Current status: **Phase 1 (RAG Core)** -- fully operational.
> Future phases: WhatsApp/WATI integration, CRM, and analytics dashboard.

---

## 1. System Overview

SellBot is an AI-powered real estate Sales Operating System built around a modular Retrieval-Augmented Generation (RAG) pipeline. Real estate developers upload property brochures, price lists, floor plans, and specification documents. SellBot ingests them, embeds them into a vector database, and answers buyer and sales-team questions with grounded, citation-backed responses.

**Technology stack (Phase 1 defaults):**

| Layer        | Technology                                     |
| ------------ | ---------------------------------------------- |
| API Server   | FastAPI (Python 3.11+), async endpoints         |
| Embeddings   | BAAI/bge-large-en-v1.5 (local, 1024 dimensions) |
| Vector DB    | pgvector (PostgreSQL + HNSW index, cosine similarity) |
| LLM          | Google Gemini Flash (1M token context window)   |
| Frontend     | React 19 + TypeScript + Vite + Tailwind CSS + Redux Toolkit |

**Core design principle:** Plugin-based architecture with abstract base classes and factory functions. Swap any embedding model, vector database, or LLM provider by editing `config.py` only -- zero code changes required.

---

## 2. Current Architecture (Phase 1 -- RAG Core)

### 2.1 Backend

- **Framework:** FastAPI with async endpoint handlers
- **Runtime:** Python 3.11+, served via Uvicorn (development) or Gunicorn + UvicornWorker (production)
- **Global state:** The embedding provider (`embedder`), vector database (`vector_db`), and LLM client (`llm_client`) are initialized at module import time as module-level globals in `app.py`
- **CORS:** Configured via `API_CONFIG["cors_origins"]` (defaults to `["*"]` for development)

### 2.2 Embeddings

- **Default provider:** Local (sentence-transformers)
- **Default model:** `BAAI/bge-large-en-v1.5` -- 1024 dimensions, best local quality
- **Alternative local models:** `all-MiniLM-L6-v2` (384d, fastest), `all-mpnet-base-v2` (768d), `e5-large-v2` (1024d)
- **Cloud providers available:** OpenAI (`text-embedding-3-small/large`), Cohere (`embed-english-v3.0`)
- **Interface:** `embed()` accepts both `str` and `List[str]`, always returns `np.ndarray` of shape `(n, dims)`

### 2.3 Vector Database

- **Default provider:** pgvector (PostgreSQL with the `vector` extension)
- **Index type:** HNSW (`vector_cosine_ops`) with `m=16, ef_construction=64`
- **Similarity metric:** Cosine similarity (`1 - cosine_distance`)
- **Table schema:** `id TEXT PK`, `embedding vector(1024)`, `text TEXT`, `metadata JSONB`, `created_at TIMESTAMP`
- **Alternative providers available:** FAISS (local, L2 distance), ChromaDB (local, persistent), Pinecone (cloud, serverless)
- **Search return format:** `List[Tuple[id, text, metadata, similarity_score]]`

### 2.4 LLM

- **Default provider:** Google Gemini
- **Default model:** `models/gemini-3-flash-preview` (experimental, free tier)
- **Generation settings:** `temperature=0.7`, `max_tokens=2048`
- **Alternative providers available:** OpenAI (`gpt-4-turbo`, `gpt-3.5-turbo`), Anthropic Claude (`claude-3-5-sonnet`)
- **Client initialization:** `create_llm_client()` in `src/llm.py` conditionally imports the correct SDK based on `LLM_CONFIG["provider"]`
- **Answer generation:** `generate_answer(llm_client, query, results)` -- takes the LLM client as an explicit parameter, dispatches to the correct API based on provider

### 2.5 Frontend (React)

- **Framework:** React 19 + TypeScript + Vite + Tailwind CSS
- **State management:** Redux Toolkit with `redux-persist` (store in `src/store/`, slices in `src/store/slices/`)
- **API layer:** Axios (`src/services/api/`)
- **Routing:** `react-router-dom` (`src/routes/`)
- **Chat rendering:** `react-markdown` + `remark-gfm` + `react-syntax-highlighter`
- **Form validation:** `zod` + `react-hook-form`
- **Icons:** `lucide-react`
- **Testing:** Vitest + jsdom + Testing Library + MSW for API mocking

---

## 3. Project Structure

```
sellbot-rag/
├── app.py                    # FastAPI server -- endpoints, global state init
├── config.py                 # All provider selection and tuning parameters
├── .env                      # API keys (GEMINI_API_KEY, PGVECTOR_CONNECTION_STRING, etc.)
│
├── src/                      # Core library package
│   ├── __init__.py
│   ├── embeddings.py         # EmbeddingProvider ABC + Local/OpenAI/Cohere implementations
│   ├── vector_databases.py   # VectorDatabase ABC + FAISS/ChromaDB/Pinecone/pgvector
│   ├── document_parsers.py   # Streaming parsers (PDF, DOCX, Excel, TXT) + chunking
│   ├── models.py             # Pydantic request/response models
│   ├── llm.py                # LLM client factory (create_llm_client) + generate_answer()
│   └── query_utils.py        # normalize_query() -- real estate shorthand normalization
│
├── scripts/                  # Utility and inspection scripts
│   ├── simple_rag.py         # End-to-end RAG flow (FAISS + Gemini, no API server)
│   ├── pinecone_rag.py       # Pinecone-specific RAG flow
│   ├── inspect_db.py         # Inspect vector DB contents and stats
│   ├── inspect_faiss.py      # FAISS-specific inspection
│   └── generate_docs.py      # Documentation generation
│
├── RAG/                      # React frontend (full chat application)
│   ├── src/
│   │   ├── components/       # chat/, common/, layout/
│   │   ├── store/            # Redux store + slices
│   │   ├── services/         # API layer (axios)
│   │   ├── routes/           # react-router-dom routes
│   │   ├── pages/            # Page-level components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   ├── i18n/             # Internationalization
│   │   ├── styles/           # Global styles
│   │   ├── __tests__/        # Vitest + MSW tests
│   │   ├── App.tsx           # Root component
│   │   └── main.tsx          # Entry point
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── knowledge_base/           # Documentation and architecture docs
├── docs/                     # Extended documentation
│   └── rag/                  # RAG-specific guides
├── real_estate_documents/    # Sample real estate documents for testing
├── vector_store/             # Local vector DB persistence (FAISS, ChromaDB)
├── session_logs/             # Session and interaction logs
├── error_logs/               # Error tracking logs
│
├── requirements_api.txt      # Primary API dependencies (cloud packages commented out)
├── requirements_production.txt # Production dependencies (gunicorn, monitoring)
└── requirements.txt          # Minimal/legacy dependencies
```

---

## 4. RAG Pipeline

### 4.1 Document Upload Flow

```
File (bytes stream)
  |
  v
validate_file_size() -----> reject if > 50 MB
  |
  v
auto_detect_and_parse() --> route to correct parser by extension
  |                          PDF: PyPDF2 or pdfplumber (configurable)
  |                          DOCX: python-docx (paragraphs + tables)
  |                          XLSX: pandas/openpyxl (all sheets combined)
  |                          TXT: UTF-8 decode with latin-1 fallback
  v
clean_text() ------------> remove PDF artifacts ([Page N], [Table N])
  |                         fix cross-line hyphenation
  |                         collapse whitespace, normalize lines
  v
chunk_text(800, 200) ----> sentence-boundary aware splitting
  |                         800 chars per chunk, 200 chars overlap
  |                         never cuts mid-sentence
  v
embedder.embed(chunks) --> BAAI/bge-large-en-v1.5 -> np.ndarray (n, 1024)
  |
  v
vector_db.add() ---------> pgvector INSERT with JSONB metadata
                            (filename, document_id, chunk_index, total_chunks, upload_time)
```

### 4.2 Query Flow

```
User question
  |
  v
normalize_query() -------> real estate shorthand expansion
  |                         "3BHK" -> "3 BHK"
  |                         "1200sqft" -> "1200 sq.ft."
  |                         "1.5cr" -> "1.5 Crores"
  |                         "50L" -> "50 Lakhs"
  |                         "INR 50" -> "Rs. 50"
  v
embedder.embed(query) ---> 1024-dimensional query vector
  |
  v
vector_db.search() ------> pgvector HNSW cosine similarity search
  |                         top_k=10 (wide net for better recall)
  |
  v
Filter results ----------> similarity_score > 0.15 threshold
  |                         (lenient -- lets borderline matches through)
  v
generate_answer() -------> Build context from chunks with source + relevance
  |                         Format system prompt v2 (9 explicit instructions)
  |                         Send to Gemini Flash
  v
Return ------------------> { answer, sources[], processing_time_ms }
                            Sources include: text preview, filename,
                            chunk_index, similarity_score
```

### 4.3 RAG Tuning Parameters (config.py)

| Parameter              | Default | Purpose                                          |
| ---------------------- | ------- | ------------------------------------------------ |
| `chunk_size`           | 800     | Target characters per chunk (larger = more context, less precise retrieval) |
| `chunk_overlap`        | 200     | Overlap between consecutive chunks (prevents splitting related info) |
| `top_k`                | 10      | Number of chunks retrieved per query (wider net for better recall) |
| `similarity_threshold` | 0.15    | Minimum cosine similarity to include a chunk      |
| `temperature`          | 0.7     | LLM generation temperature                        |
| `max_tokens`           | 2048    | Maximum tokens in LLM response                    |

---

## 5. Plugin-Based Design

The system uses abstract base classes (ABCs) with factory functions to decouple provider implementations from the pipeline. Swapping any component requires only a config change -- no code modifications.

### 5.1 Embedding Providers

**ABC:** `EmbeddingProvider` in `src/embeddings.py`

**Required methods:**
- `embed(texts: Union[str, List[str]]) -> np.ndarray`
- `get_dimensions() -> int`
- `get_model_name() -> str`

**Factory:** `get_embedding_provider(config) -> EmbeddingProvider`

| Provider | Class              | Models                              | Dimensions | Cost         |
| -------- | ------------------ | ----------------------------------- | ---------- | ------------ |
| local    | `LocalEmbeddings`  | BAAI/bge-large-en-v1.5 (default)   | 1024       | Free         |
| local    | `LocalEmbeddings`  | all-MiniLM-L6-v2                    | 384        | Free         |
| local    | `LocalEmbeddings`  | all-mpnet-base-v2                   | 768        | Free         |
| local    | `LocalEmbeddings`  | e5-large-v2                         | 1024       | Free         |
| openai   | `OpenAIEmbeddings` | text-embedding-3-small              | 1536       | $0.02/1M tok |
| openai   | `OpenAIEmbeddings` | text-embedding-3-large              | 3072       | $0.13/1M tok |
| cohere   | `CohereEmbeddings` | embed-english-v3.0                  | 1024       | Paid         |
| cohere   | `CohereEmbeddings` | embed-multilingual-v3.0             | 1024       | Paid         |

**Switching example (config.py):**
```python
EMBEDDING_CONFIG = {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "api_key": os.getenv("OPENAI_API_KEY"),
}
```

### 5.2 Vector Databases

**ABC:** `VectorDatabase` in `src/vector_databases.py`

**Required methods:**
- `add(embeddings, texts, metadata) -> List[str]`
- `search(query_embedding, top_k) -> List[Tuple[id, text, metadata, score]]`
- `save(path) -> None`
- `load(path) -> None`
- `reset() -> None`
- `get_stats() -> Dict[str, Any]`

**Factory:** `get_vector_database(config, embedding_dimensions) -> VectorDatabase`

| Provider  | Class              | Persistence       | Similarity Metric           | Best For                     |
| --------- | ------------------ | ----------------- | --------------------------- | ---------------------------- |
| faiss     | `FAISSDatabase`    | Manual save/load  | `1 / (1 + L2_distance)`    | Development, small datasets  |
| chromadb  | `ChromaDBDatabase` | Auto-persistent   | `1 - distance`              | Local dev with persistence   |
| pinecone  | `PineconeDatabase` | Cloud (auto)      | Native cosine similarity    | Production, auto-scaling     |
| pgvector  | `PgVectorDatabase` | PostgreSQL (auto) | `1 - cosine_distance`       | Production, SQL + vectors    |

**Switching example (config.py):**
```python
VECTOR_DB_CONFIG = {
    "provider": "faiss",
    "faiss": {
        "index_type": "IndexFlatL2",
        "persist_path": "./vector_store/faiss.index",
    },
}
```

### 5.3 LLM Providers

**Factory:** `create_llm_client()` in `src/llm.py` -- returns the appropriate SDK client.

**Answer generation:** `generate_answer(llm_client, query, relevant_chunks)` -- dispatches to the correct API based on `LLM_CONFIG["provider"]`.

| Provider | SDK              | Models                                     | Context Window |
| -------- | ---------------- | ------------------------------------------ | -------------- |
| gemini   | `google.genai`   | gemini-3-flash-preview, gemini-2.0-flash-exp, gemini-1.5-pro | Up to 1M tokens |
| openai   | `openai.OpenAI`  | gpt-4-turbo, gpt-4, gpt-3.5-turbo         | 128K tokens    |
| claude   | `anthropic.Anthropic` | claude-3-5-sonnet, claude-3-haiku      | 200K tokens    |

**Switching example (config.py):**
```python
LLM_CONFIG = {
    "provider": "openai",
    "model": "gpt-4-turbo",
    "openai_api_key": os.getenv("OPENAI_API_KEY"),
    "temperature": 0.7,
    "max_tokens": 2048,
}
```

### 5.4 Adding a New Provider

**New embedding provider:**
1. Create a class in `src/embeddings.py` inheriting `EmbeddingProvider`
2. Implement `embed()`, `get_dimensions()`, `get_model_name()`
3. Add a branch to `get_embedding_provider()` factory
4. Add config entry to `config.py`

**New vector database:**
1. Create a class in `src/vector_databases.py` inheriting `VectorDatabase`
2. Implement `add()`, `search()`, `save()`, `load()`, `reset()`, `get_stats()`
3. Add a branch to `get_vector_database()` factory
4. Add config entry to `config.py`

**New document parser:**
1. Add a parser function (signature: `bytes -> str`) to `src/document_parsers.py`
2. Register the extension in `auto_detect_and_parse()`
3. Update `DOCUMENT_CONFIG["supported_formats"]` in `config.py`

---

## 6. API Endpoints

All endpoints are served by FastAPI at `http://localhost:8000` (configurable via `API_CONFIG`).

### POST /upload

Upload and process a document. Streaming, in-memory -- no files written to disk.

- **Input:** Multipart file upload (`UploadFile`)
- **Supported formats:** PDF, DOCX, XLSX, TXT
- **Max size:** 50 MB (configurable)
- **Response:**
  ```json
  {
    "status": "success",
    "message": "Document processed successfully",
    "document_id": "doc_1_1700000000",
    "filename": "brochure.pdf",
    "file_info": { "filename": "brochure.pdf", "extension": "pdf", "size_bytes": 1048576, "size_mb": 1.0 },
    "chunks_added": 25,
    "total_chunks": 150,
    "processing_time_ms": 3200.50
  }
  ```

### POST /query

Query the knowledge base using RAG.

- **Input:**
  ```json
  {
    "question": "What is the price of 3 BHK in Sunrise Heights?",
    "top_k": 10
  }
  ```
- **Response:**
  ```json
  {
    "question": "What is the price of 3 BHK in Sunrise Heights?",
    "answer": "**Sunrise Heights** offers 3 BHK apartments starting at Rs. 85 Lakhs...",
    "sources": [
      {
        "text": "Sunrise Heights 3 BHK apartments range from 1200-1500 sq.ft...",
        "filename": "sunrise_heights_brochure.pdf",
        "chunk_index": 4,
        "similarity_score": 0.872
      }
    ],
    "processing_time_ms": 1850.25
  }
  ```

### GET /status

Return system health and active provider information.

- **Response:**
  ```json
  {
    "status": "running",
    "total_documents": 5,
    "total_chunks": 150,
    "embedding_model": "local/BAAI/bge-large-en-v1.5",
    "vector_db_provider": "pgvector",
    "llm_model": "gemini/models/gemini-3-flash-preview"
  }
  ```

### DELETE /reset

Clear all vectors from the database. Resets the document counter.

### POST /save

Persist the vector database to disk. Relevant for FAISS (manual save); pgvector and Pinecone auto-persist. ChromaDB auto-persists on write.

### POST /load

Load a previously saved vector database from disk. FAISS-specific; other providers auto-load.

### GET /

Root endpoint with API information and available endpoint listing.

---

## 7. Future Phases (Planned)

### Phase 2: WhatsApp/WATI Integration

- **Goal:** Enable buyer messaging through WhatsApp using the WATI Business API
- **Scope:**
  - Webhook receiver for incoming WhatsApp messages
  - Message routing to the RAG pipeline for automated responses
  - Template message support for proactive outreach (new launches, price updates)
  - Media message handling (send brochure PDFs, floor plan images)
  - Conversation session management and context tracking
  - Agent handoff for complex queries that exceed RAG capabilities

### Phase 3: CRM Integration

- **Goal:** Lead management, follow-up automation, and sales pipeline tracking
- **Scope:**
  - Lead capture from WhatsApp conversations and web chat
  - Lead scoring based on query patterns and engagement signals
  - Automated follow-up scheduling (drip campaigns via WhatsApp)
  - Sales pipeline stages (inquiry, site visit scheduled, negotiation, closed)
  - Integration with existing CRM systems (Salesforce, HubSpot) via API
  - Agent assignment and workload balancing

### Phase 4: Analytics Dashboard

- **Goal:** Insights into buyer behavior, query patterns, and sales performance
- **Scope:**
  - Query analytics: most asked questions, trending properties, search patterns
  - Document performance: which documents contribute most to answers
  - Response quality metrics: average similarity scores, unanswered query rate
  - Lead funnel analytics: conversion rates by stage, average time-to-close
  - Sales team performance: response times, lead handling metrics
  - Real-time dashboard with historical trend analysis

---

## 8. Key Design Decisions

### 8.1 In-Memory Document Processing

All document parsers accept `bytes` and return `str`. Uploaded files are never written to disk. This eliminates file system management, prevents temp file leaks, and simplifies containerized deployment. The `UploadFile` bytes are read once via `await file.read()`, parsed in-memory through `io.BytesIO`, and discarded after embedding.

### 8.2 Sentence-Boundary Aware Chunking

The `chunk_text()` function splits text at sentence endings (`.`, `!`, `?`) rather than at arbitrary character positions. This ensures that no chunk cuts a sentence in half, preserving semantic coherence. Overlap is also calculated at sentence boundaries -- trailing sentences from the previous chunk are carried forward to maintain context continuity.

### 8.3 HNSW Index Over IVFFlat

pgvector supports both IVFFlat and HNSW indexing. HNSW was chosen because:
- It works well at any dataset size (IVFFlat requires a training phase and a minimum number of vectors)
- It provides better recall accuracy for the same query latency
- It does not require periodic retraining as the dataset grows
- Configuration: `m=16` (max connections per layer), `ef_construction=64` (construction-time search breadth)

### 8.4 Lenient Similarity Threshold with High top_k

The combination of `top_k=10` and `similarity_threshold=0.15` casts a wide retrieval net. The rationale:
- Real estate queries are often imprecise ("What about that project near the highway?")
- A high `top_k` ensures the correct chunk is retrieved even if it ranks lower
- The low threshold prevents premature exclusion of borderline-relevant chunks
- The LLM (with its large context window) is better at filtering irrelevant context than a hard cosine cutoff

### 8.5 System Prompt v2 with 9 Explicit Instructions

The system prompt (`RAG_CONFIG["system_prompt"]`) includes 9 numbered instructions that guide the LLM to:
1. Read ALL context chunks (not just the first one)
2. Cite property/project names when answering
3. Organize multi-property answers with bullet points or headings
4. Present conflicting data from multiple sources
5. Use markdown formatting (bold, bullets, tables)
6. Include specific numbers (prices, areas, unit counts)
7. Prioritize higher-relevance chunks
8. Keep answers concise but complete -- no repetition
9. Provide a clear fallback message when the answer is not in the context

### 8.6 generate_answer() Takes llm_client as Explicit Parameter

Rather than accessing the LLM client as a module-level global, `generate_answer()` accepts `llm_client` as its first argument. This makes the function testable (pass a mock client), reusable (call from scripts outside the FastAPI context), and explicit about its dependencies.

### 8.7 Query Normalization for Real Estate Domain

`normalize_query()` expands common real estate shorthand before embedding:
- `3BHK` becomes `3 BHK` (matches how documents typically spell it)
- `1200sqft` becomes `1200 sq.ft.`
- `1.5cr` becomes `1.5 Crores`, `50L` becomes `50 Lakhs`
- `INR` becomes `Rs.`

This normalization bridges the gap between how buyers type queries and how property documents are written, improving embedding similarity and retrieval accuracy.

### 8.8 Text Cleaning Before Chunking

`clean_text()` runs after parsing and before chunking to remove artifacts injected by the parsers:
- Removes `[Page N]` and `[Table N]` markers from PDF/DOCX parsing
- Fixes cross-line hyphenation (`apart-\nment` becomes `apartment`)
- Collapses excessive whitespace and blank lines
- Strips leading/trailing whitespace per line

This ensures chunks contain clean, semantic text rather than formatting noise.

---

## 9. Environment Variables

```bash
# Required (default configuration)
GEMINI_API_KEY=...                    # Google Gemini API key (default LLM)
PGVECTOR_CONNECTION_STRING=...        # PostgreSQL connection string (default vector DB)
                                      # Format: postgresql://user:password@host:port/database

# Optional (enable by switching provider in config.py)
OPENAI_API_KEY=...                    # OpenAI embeddings and/or GPT LLM
ANTHROPIC_API_KEY=...                 # Anthropic Claude LLM
COHERE_API_KEY=...                    # Cohere embeddings
PINECONE_API_KEY=...                  # Pinecone vector database
```

---

## 10. Example Configuration Profiles

| Profile                  | Embedding                  | Vector DB | LLM              | Monthly Cost |
| ------------------------ | -------------------------- | --------- | ----------------- | ------------ |
| Free Local (default)     | BAAI/bge-large-en-v1.5     | pgvector  | Gemini Flash      | ~$2.50       |
| OpenAI + Local DB        | text-embedding-3-small     | FAISS     | GPT-3.5-turbo     | ~$10-20      |
| Full OpenAI + Cloud DB   | text-embedding-3-small     | Pinecone  | GPT-4-turbo       | ~$170-370    |
| OpenAI Embed + Claude    | text-embedding-3-small     | FAISS     | Claude 3.5 Sonnet | ~$120-220    |
| Best Local Quality       | e5-large-v2                | ChromaDB  | Gemini Flash      | ~$2.50       |

---

## 11. Important Constraints

1. **Embedding dimensions must match** between `EMBEDDING_CONFIG["dimensions"]` and the vector database's dimension parameter. A mismatch causes a runtime error on the first `add()` or `search()` call.

2. **All document processing is in-memory.** Parsers accept `bytes` and return `str`. Never write uploaded files to disk.

3. **Cloud provider packages are commented out** in `requirements_api.txt`. Uncomment as needed (e.g., `pinecone-client`, `openai`, `anthropic`, `cohere`).

4. **pgvector requires PostgreSQL** with the `vector` extension installed. Table and HNSW index creation is automatic in `PgVectorDatabase._setup_database()`.

5. **Similarity scoring differs by provider:**
   - FAISS: `1 / (1 + L2_distance)`
   - pgvector: `1 - cosine_distance`
   - ChromaDB: `1 - distance`
   - Pinecone: native cosine similarity

6. **`embed()` always returns `np.ndarray`.** For a single string input, the shape is `(1, dims)`. For a list, it is `(n, dims)`.

7. **`search()` always returns `List[Tuple[str, str, Dict, float]]`** -- each tuple is `(id, text, metadata, similarity_score)`, consistent across all vector database implementations.
