export type AuthRole = 'admin' | 'manager' | 'user' | 'viewer';

export type PlatformRole = 'doqyn_admin' | 'company_admin' | 'individual_admin' | 'user';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;

  companyId: string;
  /** Tenant canônico — igual a companyId durante migração */
  tenantId: string;
  companyName: string;

  role: AuthRole;
  area: string;
  groups: string[];

  memberId?: string;
  membershipId?: string;
  membershipStatus?: string;
  tenantType?: string;
  tenantStatus?: string;
  authProvider?: 'doqyn_auth' | 'temporary';
  keycloakUserId?: string;
  platformRoles?: PlatformRole[];
  avatarVersion?: number;
  avatarUpdatedAt?: string;
  avatarStatus?: 'active' | 'removed' | null;
};

export type SessionPayload = AuthUser & {
  iat?: number;
  exp?: number;
};
