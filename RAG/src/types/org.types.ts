export interface OrgInfo {
  id: number;
  name: string;
  orgUrl: string;
  iconUrl?: string;
  createdAt: string;
}

export interface OrgMember {
  id: number;
  userId: number;
  orgId: number;
  role: string;
  status: number;
  email: string;
  firstName: string;
  lastName: string;
}
