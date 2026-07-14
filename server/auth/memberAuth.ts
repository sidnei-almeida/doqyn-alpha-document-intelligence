import type { PlatformRole, MongoCompanyMember } from '../db/types.js';
import type { AuthUser } from './types.js';

const GLOBAL_ADMIN_ROLE: PlatformRole = 'doqyn_admin';
const COMPANY_ADMIN_ROLE: PlatformRole = 'company_admin';

export function getMemberPlatformRoles(member: MongoCompanyMember): PlatformRole[] {
  if (member.platformRoles?.length) return member.platformRoles;

  if (member.role === 'admin') return ['company_admin'];
  if (member.role === 'manager') return ['company_admin'];
  return ['user'];
}

export function getMemberAccessGroupIds(member: MongoCompanyMember): string[] {
  return member.accessGroupIds ?? member.groupIds ?? [];
}

export function mapLegacyRoleFromPlatformRoles(roles: PlatformRole[]): MongoCompanyMember['role'] {
  if (roles.includes('doqyn_admin') || roles.includes('company_admin')) return 'admin';
  if (roles.includes('user')) return 'member';
  return 'member';
}

export function mapMemberToAuthUser(
  member: MongoCompanyMember,
  companyName = 'DOQYN Alpha',
): AuthUser {
  const platformRoles = getMemberPlatformRoles(member);
  const groups = getMemberAccessGroupIds(member);

  return {
    id: member.authUserId ?? member.userId ?? member._id,
    email: member.email,
    name: member.name || member.email,
    username: member.username,
    companyId: member.tenantId ?? member.companyId,
    tenantId: member.tenantId ?? member.companyId,
    companyName,
    role:
      platformRoles.includes('doqyn_admin') || platformRoles.includes('company_admin')
        ? 'admin'
        : 'user',
    area: member.position ?? '',
    groups,
    memberId: member._id,
    authUserId: member.authUserId ?? member.userId,
    platformRoles,
  };
}

export function userIsDoqynAdmin(user: AuthUser): boolean {
  return user.platformRoles?.includes(GLOBAL_ADMIN_ROLE) ?? false;
}

export function userIsCompanyAdmin(user: AuthUser): boolean {
  return userIsDoqynAdmin(user) || user.platformRoles?.includes(COMPANY_ADMIN_ROLE) === true;
}

export function userCanManageUsers(user: AuthUser): boolean {
  return userIsCompanyAdmin(user);
}

export function assertCanManageCompany(user: AuthUser, targetTenantId: string): void {
  if (userIsDoqynAdmin(user)) return;
  const userTenantId = user.tenantId ?? user.companyId;
  if (userTenantId !== targetTenantId) {
    throw new Error('FORBIDDEN_COMPANY_SCOPE');
  }
}

export function resolveTargetCompanyId(user: AuthUser, _requestedTenantId?: string): string {
  const sessionTenantId = user.tenantId ?? user.companyId;
  if (!sessionTenantId?.trim()) {
    throw new Error('MISSING_TENANT_SCOPE');
  }
  return sessionTenantId;
}

/** @deprecated Use resolveTargetCompanyId */
export function resolveTargetTenantId(user: AuthUser, requestedTenantId?: string): string {
  return resolveTargetCompanyId(user, requestedTenantId);
}

export function sanitizeAssignablePlatformRoles(
  actor: AuthUser,
  roles: string[],
): PlatformRole[] {
  const allowed = new Set<PlatformRole>(['user', 'company_admin', 'individual_admin']);
  if (userIsDoqynAdmin(actor)) {
    allowed.add('doqyn_admin');
  }

  const unique = [...new Set(roles)] as PlatformRole[];
  const filtered = unique.filter((role) => allowed.has(role));

  if (!filtered.length) {
    return ['user'];
  }

  if (!userIsDoqynAdmin(actor)) {
    return filtered.filter((role) => role !== 'doqyn_admin' && role !== 'individual_admin');
  }

  return filtered;
}

export const PLATFORM_REALM_ROLES = ['doqyn_admin', 'company_admin', 'user'] as const;
