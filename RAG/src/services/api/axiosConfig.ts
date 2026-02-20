import axios from 'axios';
import static_variable from '../../functions/static_variable';

const axiosInstance = axios.create({
  baseURL: static_variable.server_url,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const apiClient = {
  get: <T>(url: string) =>
    axiosInstance.get<T>(url).then((r) => r.data),
  post: <T>(url: string, data?: unknown) =>
    axiosInstance.post<T>(url, data).then((r) => r.data),
  put: <T>(url: string, data?: unknown) =>
    axiosInstance.put<T>(url, data).then((r) => r.data),
  delete: <T>(url: string) =>
    axiosInstance.delete<T>(url).then((r) => r.data),
};

export default axiosInstance;
