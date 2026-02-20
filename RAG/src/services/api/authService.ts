import { apiClient } from './axiosConfig';
import { AUTH_URLS } from './urls';
import type { ApiResponse } from '../../types/api.types';
import type { AuthTokens, LoginCredentials, UserInfo } from '../../types/auth.types';

export const postSignin = (credentials: LoginCredentials) =>
  apiClient.post<ApiResponse<{ user: UserInfo; tokens: AuthTokens }>>(AUTH_URLS.SIGNIN, credentials);

export const postSignout = () =>
  apiClient.post<ApiResponse<null>>(AUTH_URLS.SIGNOUT);

export const postSignup = (data: { firstName: string; lastName: string; email: string; password: string }) =>
  apiClient.post<ApiResponse<{ user: UserInfo }>>(AUTH_URLS.SIGNUP, data);

export const postForgotPassword = (email: string) =>
  apiClient.post<ApiResponse<null>>(AUTH_URLS.FORGOT_PASSWORD, { email });

export const postResetPassword = (data: { token: string; password: string }) =>
  apiClient.post<ApiResponse<null>>(AUTH_URLS.RESET_PASSWORD, data);

export const postVerifyOtp = (data: { email: string; otp: string }) =>
  apiClient.post<ApiResponse<{ user: UserInfo; tokens: AuthTokens }>>(AUTH_URLS.VERIFY_OTP, data);
