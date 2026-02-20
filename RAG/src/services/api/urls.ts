import static_variable from '../../functions/static_variable';

const BASE = static_variable.server_url;

export const AUTH_URLS = {
  SIGNIN:          `${BASE}/auth/signin`,
  SIGNOUT:         `${BASE}/auth/signout`,
  SIGNUP:          `${BASE}/auth/signup`,
  FORGOT_PASSWORD: `${BASE}/auth/forgot-password`,
  RESET_PASSWORD:  `${BASE}/auth/reset-password`,
  VERIFY_OTP:      `${BASE}/auth/verify-otp`,
} as const;

export const USER_URLS = {
  GET_USER:        `${BASE}/user`,
  UPDATE_PROFILE:  `${BASE}/user/profile`,
  GET_SESSIONS:    `${BASE}/user/sessions`,
  DELETE_SESSION:   (id: number) => `${BASE}/user/sessions/${id}`,
  DELETE_ACCOUNT:  `${BASE}/user/account`,
} as const;

export const ORG_URLS = {
  GET_ORGS:        `${BASE}/organizations`,
  GET_ORG:          (id: number) => `${BASE}/organizations/${id}`,
  CREATE_ORG:      `${BASE}/organizations`,
  UPDATE_ORG:       (id: number) => `${BASE}/organizations/${id}`,
  GET_MEMBERS:      (orgId: number) => `${BASE}/organizations/${orgId}/members`,
  INVITE_MEMBER:    (orgId: number) => `${BASE}/organizations/${orgId}/members/invite`,
  REMOVE_MEMBER:    (orgId: number, memberId: number) => `${BASE}/organizations/${orgId}/members/${memberId}`,
} as const;

export const RAG_URLS = {
  QUERY:  '/query',
  UPLOAD: '/upload',
  STATUS: '/status',
  RESET:  '/reset',
} as const;
