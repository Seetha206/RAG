export const MemberStatus = {
  INVITED: 1,
  ACTIVE: 2,
  INACTIVE: 3,
  DISABLED: 4,
} as const;

export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const getMemberStatusLabel = (status: MemberStatus): string => {
  const labels: Record<MemberStatus, string> = {
    [MemberStatus.INVITED]: 'Invited',
    [MemberStatus.ACTIVE]: 'Active',
    [MemberStatus.INACTIVE]: 'Inactive',
    [MemberStatus.DISABLED]: 'Disabled',
  };
  return labels[status] ?? 'Unknown';
};

export const UserRole = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  GUEST: 'Guest',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const STRING_LENGTH = {
  MIN_NAME: 2,
  MAX_NAME: 50,
  MIN_PASSWORD: 8,
  MAX_PASSWORD: 128,
  MAX_EMAIL: 254,
  MAX_DESCRIPTION: 500,
} as const;

export const TIMING = {
  DEBOUNCE_MS: 300,
  THROTTLE_MS: 1000,
  TOAST_DURATION_MS: 5000,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
} as const;

export const DEFAULT_COUNTRY = 'US';
export const DEFAULT_TIMEZONE = 'America/New_York';
