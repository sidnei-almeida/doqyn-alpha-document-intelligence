import { i18n } from '@/i18n';
import type { PlatformRole } from './api/usersApi';

/**
 * Papéis que o admin da empresa pode marcar na tela de usuários. Espelha
 * `sanitizeAssignablePlatformRoles` no servidor — `individual_admin` fica de fora porque nasce com
 * o tenant PF no auth-service, não é concedido por ninguém aqui.
 */
export const ASSIGNABLE_PLATFORM_ROLES: PlatformRole[] = ['company_admin', 'user'];

export type PlatformRoleMeta = {
  label: string;
  description: string;
};

/**
 * O papel é dado do auth-service; o rótulo é catálogo.
 *
 * `getPlatformRoleMeta` resolve na chamada — roda dentro do render de quem lista usuários — e
 * cai no próprio slug quando o papel é desconhecido, que continua sendo a informação mais
 * honesta que existe naquele momento.
 */
const PLATFORM_ROLE_KEYS: Record<PlatformRole, string> = {
  company_admin: 'users:platformRole.company_admin',
  individual_admin: 'users:platformRole.individual_admin',
  user: 'users:platformRole.user',
};

/** Ordem de prioridade para exibir o papel principal do usuário. */
export const PLATFORM_ROLE_PRIORITY: PlatformRole[] = ['company_admin', 'individual_admin', 'user'];

export function getPlatformRoleMeta(role: string): PlatformRoleMeta {
  const base = PLATFORM_ROLE_KEYS[role as PlatformRole];
  if (!base) {
    return { label: role, description: i18n.t('users:platformRole.unknownDescription') };
  }
  return { label: i18n.t(`${base}.label`), description: i18n.t(`${base}.description`) };
}

export function getPlatformRoleLabel(role: string): string {
  return getPlatformRoleMeta(role).label;
}

export function resolvePrimaryPlatformRole(roles: string[]): string | null {
  for (const role of PLATFORM_ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? null;
}

export function formatPlatformRoles(roles: PlatformRole[]): string {
  if (!roles.length) return '—';
  return roles.map((role) => getPlatformRoleLabel(role)).join(', ');
}

export function formatPlatformRolesList(roles: string[]): string {
  if (!roles.length) return '—';
  return roles.map((role) => getPlatformRoleLabel(role)).join(', ');
}

/** Labels para o papel legado do AuthUser (`admin`, `manager`, `user`, `viewer`). */
const LEGACY_AUTH_ROLE_KEYS: Record<string, string> = {
  admin: 'users:legacyAuthRole.admin',
  manager: 'users:legacyAuthRole.manager',
  user: 'users:legacyAuthRole.user',
  viewer: 'users:legacyAuthRole.viewer',
};

export function getAuthRoleLabel(role: string): string {
  const key = LEGACY_AUTH_ROLE_KEYS[role];
  return key ? i18n.t(key) : getPlatformRoleLabel(role);
}
