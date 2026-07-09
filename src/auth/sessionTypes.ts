export type MeUser = {
  id?: string;
  keycloakUserId?: string;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  avatarVersion?: number;
  avatarUpdatedAt?: string | null;
  avatarStatus?: 'active' | 'removed' | null;
  avatarUrl?: string;
};

export type MeTenant = {
  tenantId: string;
  tenantType: string;
  displayName: string;
  status: string;
  taxIdType?: string;
  taxIdMasked?: string;
};

export type MeMembership = {
  membershipId?: string;
  status: string;
  tenantRoles: string[];
  accessGroupIds: string[];
};

export type MeSession = {
  ok?: boolean;
  authProvider?: string;
  user: MeUser;
  tenant: MeTenant;
  membership: MeMembership;
};

export type AccessGateReason =
  | 'not_linked'
  | 'pending'
  | 'blocked'
  | 'rejected'
  | 'removed'
  | 'no_membership';
