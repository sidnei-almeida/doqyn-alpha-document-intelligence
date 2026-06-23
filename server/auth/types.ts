export type AuthRole = 'admin' | 'manager' | 'user' | 'viewer';

export type AuthUser = {
  id: string;
  email: string;
  name: string;

  companyId: string;
  companyName: string;

  role: AuthRole;
  area: string;
  groups: string[];
};

export type SessionPayload = AuthUser & {
  iat?: number;
  exp?: number;
};
