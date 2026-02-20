export interface UserInfo {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  token: string;
  expiresAt: string;
}
