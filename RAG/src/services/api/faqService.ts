import axiosInstance from './axiosConfig';
import { RAG_URLS } from './urls';
import type { FAQsResponse } from '../../types/faq.types';

export const getFAQs = (project_id?: string): Promise<FAQsResponse> => {
  const params = project_id ? { project_id } : {};
  return axiosInstance
    .get<FAQsResponse>(RAG_URLS.FAQS, { params })
    .then((r) => r.data);
};

export const deleteFAQ = (faqId: number, project_id?: string): Promise<void> => {
  const params = project_id ? { project_id } : {};
  return axiosInstance
    .delete(RAG_URLS.FAQ_DELETE(faqId), { params })
    .then(() => undefined);
};

export const clearChatFAQs = (project_id?: string): Promise<void> => {
  const params = project_id ? { project_id } : {};
  return axiosInstance
    .delete(RAG_URLS.FAQ_CHAT_CLEAR, { params })
    .then(() => undefined);
};
