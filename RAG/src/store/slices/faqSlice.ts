import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { FAQCategoryData } from '../../types/faq.types';

interface FAQState {
  categories: FAQCategoryData[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: FAQState = {
  categories: [],
  total: 0,
  isLoading: false,
  error: null,
};

const faqSlice = createSlice({
  name: 'faq',
  initialState,
  reducers: {
    setFAQs(state, action: PayloadAction<{ categories: FAQCategoryData[]; total: number }>) {
      state.categories = action.payload.categories;
      state.total = action.payload.total;
      state.isLoading = false;
      state.error = null;
    },
    setFAQLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setFAQError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setFAQs, setFAQLoading, setFAQError } = faqSlice.actions;

type StateWithFAQ = { faq: FAQState };

export const selectFAQCategories = (state: StateWithFAQ) => state.faq.categories;
export const selectFAQTotal = (state: StateWithFAQ) => state.faq.total;
export const selectFAQLoading = (state: StateWithFAQ) => state.faq.isLoading;
export const selectFAQError = (state: StateWithFAQ) => state.faq.error;

export default faqSlice.reducer;
