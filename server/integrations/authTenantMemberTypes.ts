import type { TenantMemberStatus } from '../db/types.js';

export type AuthTenantMemberSyncSnapshot = {
  membershipId: string;
  tenantId: string;
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  whatsapp?: string | null;
  status: TenantMemberStatus;
  tenantRoles: string[];
  accessGroupIds: string[];
  invitedBy?: string | null;
  approvedAt?: string | null;
  jobTitle?: string | null;
  departmentText?: string | null;
  source?: 'admin_invite' | 'access_request' | 'migration' | 'manual_seed';
  createdAt?: string;
  updatedAt?: string;
};
