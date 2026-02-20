// TypeScript types mirroring the FastAPI Pydantic models in app.py

export interface QueryRequest {
  question: string;
  top_k?: number;
}

export interface Source {
  text: string;
  filename: string;
  chunk_index: number;
  similarity_score: number;
}

export interface QueryResponse {
  question: string;
  answer: string;
  sources: Source[];
  processing_time_ms: number;
}

export interface UploadResponse {
  status: string;
  message: string;
  document_id: string;
  filename: string;
  file_info: Record<string, unknown>;
  chunks_added: number;
  total_chunks: number;
  processing_time_ms: number;
}

export interface StatusResponse {
  status: string;
  total_documents: number;
  total_chunks: number;
  embedding_model: string;
  vector_db_provider: string;
  llm_model: string;
}
