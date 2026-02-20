import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserInfo } from '../../types/auth.types';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  showOtpVerification: boolean;
  userEmail: string;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  showOtpVerification: false,
  userEmail: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ user: UserInfo; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },
    logout() {
      return { ...initialState };
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError(state) {
      state.error = null;
    },
    setShowOtpVerification(state, action: PayloadAction<boolean>) {
      state.showOtpVerification = action.payload;
    },
    setUserEmail(state, action: PayloadAction<string>) {
      state.userEmail = action.payload;
    },
  },
});

export const {
  loginSuccess,
  logout,
  setLoading,
  setError,
  clearError,
  setShowOtpVerification,
  setUserEmail,
} = authSlice.actions;

export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectToken = (state: { auth: AuthState }) => state.auth.token;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectShowOtpVerification = (state: { auth: AuthState }) => state.auth.showOtpVerification;
export const selectUserEmail = (state: { auth: AuthState }) => state.auth.userEmail;

export default authSlice.reducer;
