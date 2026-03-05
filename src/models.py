"""Request/response models for the RAG API."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
import uuid as _uuid_module

from config import RAG_CONFIG


def _validate_uuid(v: Optional[str]) -> Optional[str]:
    """Shared UUID validator used by multiple models (ISSUE_006)."""
    if v is None:
        return v
    try:
        _uuid_module.UUID(v)
    except ValueError:
        raise ValueError("must be a valid UUID (e.g. '550e8400-e29b-41d4-a716-446655440000')")
    return v


class QueryRequest(BaseModel):
    """Query request model."""
    question: str
    top_k: Optional[int] = Field(default=RAG_CONFIG["top_k"], ge=1, le=50)  # ISSUE_015
    project_id: Optional[str] = None  # None → backend uses default project
    global_search: bool = False  # True → search all projects (ISSUE_021 Dashboard chat)

    @field_validator("project_id")
    @classmethod
    def validate_project_id(cls, v):  # ISSUE_006
        return _validate_uuid(v)


class QueryResponse(BaseModel):
    """Query response model."""
    question: str
    answer: str
    sources: List[Dict[str, Any]]
    processing_time_ms: float
    source_type: str = "rag"  # "faq" | "rag"


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
    faqs_generated: int = 0


class StatusResponse(BaseModel):
    """Status response model."""
    status: str
    total_documents: int
    total_chunks: int
    embedding_model: str
    vector_db_provider: str
    llm_model: str


# ---------------------------------------------------------------------------
# FAQ Models
# ---------------------------------------------------------------------------

class FAQEntry(BaseModel):
    """A single FAQ question-answer pair."""
    id: int
    question: str
    answer: str
    category: str
    source_file: Optional[str] = None


class FAQCategoryData(BaseModel):
    """A category with its associated FAQs."""
    name: str
    color: str
    icon: str
    faqs: List[FAQEntry]


class FAQsResponse(BaseModel):
    """Full FAQ response for the mind map."""
    categories: List[FAQCategoryData]
    total: int


# ---------------------------------------------------------------------------
# Project Models (Multi-Project Phase)
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    """Request body for creating a new project."""
    project_name: str = Field(min_length=1, max_length=255)  # ISSUE_014


class ProjectResponse(BaseModel):
    """Single project details."""
    project_id: str
    project_name: str
    vdb_namespace: str
    created_at: Optional[str] = None


class ProjectListResponse(BaseModel):
    """List of all projects."""
    projects: List[ProjectResponse]
    total: int
