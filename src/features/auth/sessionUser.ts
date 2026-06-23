import type { AuthUser, AuthRole } from './types';
import type { AuthSession } from '@/types/user';

function mapRole(roles: string[]): AuthRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('document_manager') || roles.includes('manager')) return 'manager';
  if (roles.includes('viewer')) return 'viewer';
  return 'user';
}

export function mapSessionToAuthUser(session: AuthSession): AuthUser {
  const { user } = session;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyId: user.tenantId,
    companyName: '',
    role: mapRole(user.roles),
    area: '',
    groups: [],
  };
}
