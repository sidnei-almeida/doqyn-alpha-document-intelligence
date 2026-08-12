import type { PlatformRole, MongoCompanyMember } from '../db/types.js';
import type { AuthUser } from './types.js';

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
  if (roles.includes('company_admin')) return 'admin';
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
    role: platformRoles.includes('company_admin') ? 'admin' : 'user',
    area: member.position ?? '',
    groups,
    memberId: member._id,
    authUserId: member.authUserId ?? member.userId,
    platformRoles,
  };
}

export function userIsCompanyAdmin(user: AuthUser): boolean {
  return user.platformRoles?.includes(COMPANY_ADMIN_ROLE) === true;
}

export function userCanManageUsers(user: AuthUser): boolean {
  return userIsCompanyAdmin(user);
}

/**
 * Só governa o tenant da própria sessão. Não existe mais escape hatch de plataforma aqui — o antigo
 * `if (userIsDoqynAdmin(user)) return;` era o que permitia gerir empresa de terceiro. Operação de
 * plataforma cross-tenant volta na fase 2, por chave interna auditada, nunca por sessão humana.
 */
export function assertCanManageCompany(user: AuthUser, targetTenantId: string): void {
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

/**
 * Papéis que a gestão de usuários de um tenant PJ pode atribuir. `individual_admin` fica de fora de
 * propósito: ele nasce com o tenant PF no auth-service, não é concedido por ninguém aqui. Antes, o
 * único caminho para atribuí-lo era carregar o papel global de plataforma, que não existe mais.
 *
 * Não recebe mais o ator: sem papel de plataforma, o conjunto atribuível é o mesmo para todo mundo
 * que passa por `requireUserManager`.
 */
export function sanitizeAssignablePlatformRoles(roles: string[]): PlatformRole[] {
  const allowed = new Set<PlatformRole>(['user', 'company_admin']);

  const unique = [...new Set(roles)] as PlatformRole[];
  const filtered = unique.filter((role) => allowed.has(role));

  if (!filtered.length) {
    return ['user'];
  }

  return filtered;
}
