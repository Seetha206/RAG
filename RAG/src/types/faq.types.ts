export interface FAQEntry {
  id: number;
  question: string;
  answer: string;
  category: string;
  source_file?: string;
}

export interface FAQCategoryData {
  name: string;
  color: string;
  icon: string;
  faqs: FAQEntry[];
}

export interface FAQsResponse {
  categories: FAQCategoryData[];
  total: number;
}
