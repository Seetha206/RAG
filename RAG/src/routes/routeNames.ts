export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgotpassword',
  RESET_PASSWORD: '/resetpassword',
  ONBOARDING: '/onboarding',
  MY_PROFILE:      (org: string) => `/${org}/myprofile`,
  ORGANIZATION:    (org: string) => `/${org}/organization`,
  SIGNIN_DEVICES:  (org: string) => `/${org}/signindevices`,
  RECENT_ACTIVITY: (org: string) => `/${org}/recentactivity`,
  DELETE_ACCOUNT:  (org: string) => `/${org}/deleteaccount`,
} as const;
