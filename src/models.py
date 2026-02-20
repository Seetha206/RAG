"""Request/response models for the RAG API."""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from config import RAG_CONFIG


class QueryRequest(BaseModel):
    """Query request model."""
    question: str
    top_k: Optional[int] = RAG_CONFIG["top_k"]


class QueryResponse(BaseModel):
    """Query response model."""
    question: str
    answer: str
    sources: List[Dict[str, Any]]
    processing_time_ms: float


class UploadResponse(BaseModel):
    """Upload response model."""
    status: str
    message: str
    document_id: str
    filename: str
    file_info: Dict[str, Any]
    chunks_added: int
    total_chunks: int
    processing_time_ms: float


class StatusResponse(BaseModel):
    """Status response model."""
    status: str
    total_documents: int
    total_chunks: int
    embedding_model: str
    vector_db_provider: str
    llm_model: str
