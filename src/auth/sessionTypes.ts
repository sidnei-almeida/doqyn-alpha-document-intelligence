export type MeUser = {
  keycloakUserId?: string;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
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
  status: string;
  tenantRoles: string[];
  accessGroupIds: string[];
};

export type MeSession = {
  user: MeUser;
  tenant: MeTenant;
  membership: MeMembership;
};

export type AccessGateReason = 'not_linked' | 'pending' | 'blocked';
