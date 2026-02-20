"""
Configuration file for RAG system.
Change providers by modifying these configs - no code changes needed!
"""

import os
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# EMBEDDING CONFIGURATION
# =============================================================================
# To swap embedding providers, just change these 3 lines!

EMBEDDING_CONFIG = {
    # Options: "local", "openai", "cohere"
    "provider": "local",

    # Model names by provider:
    # - local: "BAAI/bge-large-en-v1.5", "all-MiniLM-L6-v2", "all-mpnet-base-v2", "e5-large-v2"
    # - openai: "text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"
    # - cohere: "embed-english-v3.0", "embed-multilingual-v3.0"
    "model": "BAAI/bge-large-en-v1.5",  # Best local embedding model! (recommended)

    # Dimensions (must match model):
    # - BAAI/bge-large-en-v1.5: 1024 (RECOMMENDED - best quality)
    # - all-MiniLM-L6-v2: 384
    # - all-mpnet-base-v2: 768
    # - e5-large-v2: 1024
    # - text-embedding-3-small: 1536
    # - text-embedding-3-large: 3072
    # - embed-english-v3.0: 1024
    "dimensions": 1024,

    # API keys (only needed for cloud providers)
    "api_key": os.getenv("OPENAI_API_KEY") or os.getenv("COHERE_API_KEY"),
}

# =============================================================================
# VECTOR DATABASE CONFIGURATION
# =============================================================================
# To swap vector DB providers, just change these lines!

VECTOR_DB_CONFIG = {
    # Options: "faiss", "chromadb", "pinecone", "weaviate", "qdrant", "pgvector"
    "provider": "pgvector",  # Using PostgreSQL with vector extension!

    # FAISS-specific settings
    "faiss": {
        "index_type": "IndexFlatL2",  # Options: IndexFlatL2, IndexFlatIP, IndexIVFFlat
        "persist_path": "./vector_store/faiss.index",
        "metadata_path": "./vector_store/metadata.json",
    },

    # ChromaDB-specific settings
    "chromadb": {
        "persist_directory": "./vector_store/chromadb",
        "collection_name": "rag_documents",
    },

    # Pinecone-specific settings
    "pinecone": {
        "api_key": os.getenv("PINECONE_API_KEY"),
        "environment": os.getenv("PINECONE_ENV", "us-east-1"),
        "index_name": "sellbot-rag",
    },

    # Weaviate-specific settings
    "weaviate": {
        "url": os.getenv("WEAVIATE_URL", "http://localhost:8080"),
        "api_key": os.getenv("WEAVIATE_API_KEY"),
        "class_name": "Document",
    },

    # Qdrant-specific settings
    "qdrant": {
        "url": os.getenv("QDRANT_URL", "http://localhost:6333"),
        "api_key": os.getenv("QDRANT_API_KEY"),
        "collection_name": "rag_documents",
    },

    # pgvector-specific settings (PostgreSQL with vector extension)
    "pgvector": {
        # Connection string format: postgresql://user:password@host:port/database
        "connection_string": os.getenv(
            "PGVECTOR_CONNECTION_STRING",
            "postgresql://postgres:password@localhost:5432/rag_db"
        ),
        "table_name": "rag_documents",
    },
}

# =============================================================================
# LLM CONFIGURATION
# =============================================================================
# Configure which LLM to use for answer generation

LLM_CONFIG = {
    # Options: "gemini", "openai", "claude"
    "provider": "gemini",

    # Model names by provider:
    # - gemini: "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro"
    # - openai: "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"
    # - claude: "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"
    "model": "models/gemini-3-flash-preview",  # Latest Gemini model! (experimental, free tier)

    # API keys
    "gemini_api_key": os.getenv("GEMINI_API_KEY"),
    "openai_api_key": os.getenv("OPENAI_API_KEY"),
    "anthropic_api_key": os.getenv("ANTHROPIC_API_KEY"),

    # Generation settings
    "temperature": 0.7,
    "max_tokens": 2048,
}

# =============================================================================
# RAG PIPELINE CONFIGURATION
# =============================================================================

RAG_CONFIG = {
    # Text chunking (sentence-boundary aware)
    "chunk_size": 800,
    "chunk_overlap": 200,

    # Retrieval
    "top_k": 10,  # Number of chunks to retrieve (wider net for better recall)
    "similarity_threshold": 0.15,  # Minimum cosine similarity to include a chunk

    # System prompt
    "system_prompt": """You are SellBot AI, a knowledgeable real estate sales assistant. Answer the question using ONLY the context chunks provided below.

## Instructions
1. Read ALL context chunks carefully — the answer may be in any chunk, not just the first one.
2. When citing information, mention the property or project name (e.g., "Sunrise Heights offers...").
3. If the question relates to multiple properties, organize your answer by property using bullet points or bold headings.
4. If two sources give different data for the same thing, present both and note the difference.
5. Use markdown: **bold** for property names, bullet points for lists, and tables when comparing across properties.
6. Be specific — include exact prices, areas (sq.ft.), unit counts, and other numbers as stated in the context.
7. Prioritize chunks with higher relevance scores — they are more likely to contain the answer.
8. Keep answers concise but complete. Do not repeat the same information twice.
9. If the answer truly cannot be found anywhere in the context, say: "I couldn't find that information in the uploaded documents. Try rephrasing your question or uploading relevant documents."

Context:
{context}

Question: {query}

Answer:""",
}

# =============================================================================
# DOCUMENT PROCESSING CONFIGURATION
# =============================================================================

DOCUMENT_CONFIG = {
    # Supported file types
    "supported_formats": [".pdf", ".docx", ".xlsx", ".txt"],

    # Maximum file size (in MB)
    "max_file_size_mb": 50,

    # PDF parsing
    "pdf_parser": "pypdf2",  # Options: "pypdf2", "pdfplumber"

    # Excel parsing
    "excel_combine_sheets": True,  # Combine all sheets into one document
}

# =============================================================================
# API CONFIGURATION
# =============================================================================

API_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "reload": True,  # Auto-reload on code changes (development only)
    "cors_origins": ["*"],  # Allow all origins (adjust for production)
}

# =============================================================================
# EXAMPLE CONFIGURATIONS FOR QUICK SWITCHING
# =============================================================================

"""
# Configuration 1: Free Local Setup (Current)
EMBEDDING_CONFIG = {"provider": "local", "model": "all-MiniLM-L6-v2", "dimensions": 384}
VECTOR_DB_CONFIG = {"provider": "faiss"}
LLM_CONFIG = {"provider": "gemini", "model": "gemini-2.5-flash"}
Cost: ~$2.50/month

# Configuration 2: OpenAI Embeddings + Local Vector DB
EMBEDDING_CONFIG = {"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}
VECTOR_DB_CONFIG = {"provider": "faiss"}
LLM_CONFIG = {"provider": "openai", "model": "gpt-3.5-turbo"}
Cost: ~$10-20/month

# Configuration 3: Full OpenAI Stack + Cloud Vector DB
EMBEDDING_CONFIG = {"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}
VECTOR_DB_CONFIG = {"provider": "pinecone"}
LLM_CONFIG = {"provider": "openai", "model": "gpt-4-turbo"}
Cost: ~$170-370/month

# Configuration 4: OpenAI Embeddings + Claude LLM
EMBEDDING_CONFIG = {"provider": "openai", "model": "text-embedding-3-small", "dimensions": 1536}
VECTOR_DB_CONFIG = {"provider": "faiss"}
LLM_CONFIG = {"provider": "claude", "model": "claude-3-5-sonnet-20241022"}
Cost: ~$120-220/month

# Configuration 5: Best Local Quality
EMBEDDING_CONFIG = {"provider": "local", "model": "e5-large-v2", "dimensions": 1024}
VECTOR_DB_CONFIG = {"provider": "chromadb"}
LLM_CONFIG = {"provider": "gemini", "model": "gemini-2.5-flash"}
Cost: ~$2.50/month
"""
