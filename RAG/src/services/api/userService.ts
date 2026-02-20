import { apiClient } from './axiosConfig';
import { USER_URLS } from './urls';
import type { ApiResponse } from '../../types/api.types';
import type { UserInfo } from '../../types/auth.types';

export const getUser = () =>
  apiClient.get<ApiResponse<UserInfo>>(USER_URLS.GET_USER);

export const putProfile = (data: Partial<UserInfo>) =>
  apiClient.put<ApiResponse<UserInfo>>(USER_URLS.UPDATE_PROFILE, data);

export const getSessions = () =>
  apiClient.get<ApiResponse<{ id: number; device: string; lastActive: string }[]>>(USER_URLS.GET_SESSIONS);

export const deleteSession = (id: number) =>
  apiClient.delete<ApiResponse<null>>(USER_URLS.DELETE_SESSION(id));

export const deleteAccount = () =>
  apiClient.delete<ApiResponse<null>>(USER_URLS.DELETE_ACCOUNT);
