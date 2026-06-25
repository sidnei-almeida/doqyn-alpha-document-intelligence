/** Tipo de autenticação ativo no frontend. */
export type AuthProviderType = 'keycloak' | 'mock' | 'temporary';

const LEGACY_AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'temporary';

/**
 * `VITE_AUTH_PROVIDER` tem prioridade sobre `VITE_AUTH_MODE` legado.
 * - keycloak: Keycloak JS + PKCE
 * - mock: usuário dev em memória, sem Keycloak
 * - temporary: sessão via API/cookie (comportamento anterior)
 */
export function getAuthProviderType(): AuthProviderType {
  const provider = import.meta.env.VITE_AUTH_PROVIDER?.trim().toLowerCase();

  if (provider === 'keycloak') return 'keycloak';
  if (provider === 'mock') return 'mock';

  if (LEGACY_AUTH_MODE === 'temporary') return 'temporary';
  if (LEGACY_AUTH_MODE === 'keycloak') return 'keycloak';

  return 'mock';
}

export function usesKeycloakAuth(): boolean {
  return getAuthProviderType() === 'keycloak';
}

export function usesMockAuth(): boolean {
  return getAuthProviderType() === 'mock';
}

export function usesApiAuth(): boolean {
  return getAuthProviderType() === 'temporary';
}
