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
 *
 * As frases moram em `common`, o catálogo embutido: quem chama é o menu do cabeçalho e as
 * configurações, que não carregam `users`, e com as chaves lá o perfil mostrava
 * `platformRole.individual_admin.label` no lugar do papel.
 */
const PLATFORM_ROLE_KEYS: Record<PlatformRole, string> = {
  company_admin: 'common:platformRole.company_admin',
  individual_admin: 'common:platformRole.individual_admin',
  user: 'common:platformRole.user',
};

/** Ordem de prioridade para exibir o papel principal do usuário. */
export const PLATFORM_ROLE_PRIORITY: PlatformRole[] = ['company_admin', 'individual_admin', 'user'];

export function getPlatformRoleMeta(role: string): PlatformRoleMeta {
  const base = PLATFORM_ROLE_KEYS[role as PlatformRole];
  if (!base) {
    return { label: role, description: i18n.t('common:platformRole.unknownDescription') };
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
  admin: 'common:legacyAuthRole.admin',
  manager: 'common:legacyAuthRole.manager',
  user: 'common:legacyAuthRole.user',
  viewer: 'common:legacyAuthRole.viewer',
};

export function getAuthRoleLabel(role: string): string {
  const key = LEGACY_AUTH_ROLE_KEYS[role];
  return key ? i18n.t(key) : getPlatformRoleLabel(role);
}
