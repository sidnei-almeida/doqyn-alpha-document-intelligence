import type { AuthUser, AuthRole } from '@/features/auth/types';
import type { MeMembership, MeSession, AccessGateReason } from './sessionTypes';

function mapTenantRolesToAuthRole(roles: string[]): AuthRole {
  if (roles.includes('doqyn_admin')) return 'admin';
  if (roles.includes('company_admin')) return 'manager';
  if (roles.includes('viewer')) return 'viewer';
  return 'user';
}

export function mapMeSessionToAuthUser(session: MeSession): AuthUser {
  const { user, tenant, membership } = session;
  const roles = membership.tenantRoles ?? [];
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    user.email;

  return {
    id: user.id ?? user.keycloakUserId ?? user.email,
    email: user.email,
    name: displayName,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    companyId: tenant.tenantId,
    companyName: tenant.displayName,
    role: mapTenantRolesToAuthRole(roles),
    area: '',
    groups: membership.accessGroupIds ?? [],
    roles,
  };
}

export function resolveAccessGate(
  membership: MeMembership | null,
): AccessGateReason | null {
  if (!membership) return 'no_membership';
  if (membership.status === 'pending') return 'pending';
  if (membership.status === 'blocked') return 'blocked';
  if (membership.status === 'removed') return 'removed';
  return null;
}
