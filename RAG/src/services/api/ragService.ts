import axiosInstance, { apiClient } from './axiosConfig';
import { RAG_URLS } from './urls';
import type {
  QueryRequest,
  QueryResponse,
  UploadResponse,
  StatusResponse,
} from '../../types/rag.types';

export const postQuery = (data: QueryRequest) =>
  apiClient.post<QueryResponse>(RAG_URLS.QUERY, data);

export const postUpload = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axiosInstance.post<UploadResponse>(
    RAG_URLS.UPLOAD,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }
  );
  return response.data;
};

export const getStatus = () =>
  apiClient.get<StatusResponse>(RAG_URLS.STATUS);
