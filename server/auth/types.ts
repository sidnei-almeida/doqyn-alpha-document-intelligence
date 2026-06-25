export type AuthRole = 'admin' | 'manager' | 'user' | 'viewer';

export type PlatformRole = 'doqyn_admin' | 'company_admin' | 'individual_admin' | 'user';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string;

  companyId: string;
  /** Tenant canônico — igual a companyId durante migração */
  tenantId: string;
  companyName: string;

  role: AuthRole;
  area: string;
  groups: string[];

  memberId?: string;
  keycloakUserId?: string;
  platformRoles?: PlatformRole[];
  keycloakRoles?: string[];
};

export type SessionPayload = AuthUser & {
  iat?: number;
  exp?: number;
};
