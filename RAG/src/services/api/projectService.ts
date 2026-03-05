import axiosInstance from './axiosConfig';
import { RAG_URLS } from './urls';
import type { ProjectResponse, ProjectListResponse, ProjectDocumentsResponse } from '../../types/rag.types';

export const getProjects = (): Promise<ProjectListResponse> =>
  axiosInstance.get<ProjectListResponse>(RAG_URLS.PROJECTS).then((r) => r.data);

export const createProject = (project_name: string): Promise<ProjectResponse> =>
  axiosInstance
    .post<ProjectResponse>(RAG_URLS.PROJECTS, { project_name })
    .then((r) => r.data);

export const getProjectDocuments = (projectId: string): Promise<ProjectDocumentsResponse> =>
  axiosInstance
    .get<ProjectDocumentsResponse>(RAG_URLS.PROJECT_DOCUMENTS(projectId))
    .then((r) => r.data);

export const deleteProjectDocument = (projectId: string, documentId: string): Promise<{ status: string; filename: string }> =>
  axiosInstance
    .delete<{ status: string; filename: string }>(RAG_URLS.PROJECT_DOCUMENT_DELETE(projectId, documentId))
    .then((r) => r.data);
