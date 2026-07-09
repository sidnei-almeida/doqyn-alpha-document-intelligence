export type AuthRole = 'admin' | 'manager' | 'user' | 'viewer';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;

  companyId: string;
  companyName: string;

  role: AuthRole;
  area: string;
  groups: string[];
  /** Roles da plataforma ou equivalente em mock. */
  roles?: string[];
  avatarVersion?: number;
  avatarUpdatedAt?: string;
  avatarStatus?: 'active' | 'removed' | null;
  avatarUrl?: string;
};
