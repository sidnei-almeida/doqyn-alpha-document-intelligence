import type { KeycloakTokenParsed } from 'keycloak-js';
import type { AuthUser, AuthRole } from '@/features/auth/types';

const SYSTEM_ROLES = new Set([
  'offline_access',
  'uma_authorization',
  'default-roles-doqyn',
]);

function mapKeycloakRole(roles: string[]): AuthRole {
  if (roles.includes('doqyn_admin')) return 'admin';
  if (roles.includes('company_admin')) return 'manager';
  if (roles.includes('viewer')) return 'viewer';
  return 'user';
}

function filterDisplayRoles(roles: string[]): string[] {
  return roles.filter((role) => !SYSTEM_ROLES.has(role) && !role.startsWith('default-roles-'));
}

/**
 * Fallback mínimo a partir do token Keycloak — não define tenantId oficial.
 * Use mapMeSessionToAuthUser após GET /api/me.
 */
export function mapKeycloakTokenToAuthUser(token: KeycloakTokenParsed): AuthUser {
  const realmRoles = token.realm_access?.roles ?? [];
  const displayRoles = filterDisplayRoles(realmRoles);

  return {
    id: token.sub ?? '',
    email: token.email ?? '',
    name: token.name ?? token.preferred_username ?? 'Usuário',
    username: token.preferred_username,
    firstName: token.given_name,
    lastName: token.family_name,
    companyId: '',
    companyName: '',
    role: mapKeycloakRole(realmRoles),
    area: '',
    groups: displayRoles,
    roles: displayRoles,
  };
}
