// TypeScript types mirroring the FastAPI Pydantic models in app.py

export interface QueryRequest {
  question: string;
  top_k?: number;
  project_id?: string;
  global_search?: boolean;
}

export interface ProjectDocument {
  filename: string;
  document_id: string;
  chunk_count: number;
  upload_time: number;
}

export interface ProjectDocumentsResponse {
  documents: ProjectDocument[];
  total: number;
}

export interface ProjectResponse {
  project_id: string;
  project_name: string;
  vdb_namespace: string;
  created_at?: string;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  total: number;
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
  source_type?: string;
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
  faqs_generated?: number;
}

export interface StatusResponse {
  status: string;
  total_documents: number;
  total_chunks: number;
  embedding_model: string;
  vector_db_provider: string;
  llm_model: string;
}
