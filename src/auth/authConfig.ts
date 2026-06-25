/** Tipo de autenticação ativo no frontend. */
export type AuthProviderType = 'doqyn_auth' | 'keycloak' | 'mock' | 'temporary';

const LEGACY_AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'temporary';

/**
 * `VITE_AUTH_PROVIDER` tem prioridade sobre `VITE_AUTH_MODE` legado.
 * - doqyn_auth: doqyn-auth-service (cookie HttpOnly + /api/me)
 * - keycloak: legado (descontinuado)
 * - mock: usuário dev em memória
 * - temporary: JWT local legado
 */
export function getAuthProviderType(): AuthProviderType {
  const provider = import.meta.env.VITE_AUTH_PROVIDER?.trim().toLowerCase();

  if (provider === 'doqyn_auth') return 'doqyn_auth';
  if (provider === 'keycloak') return 'keycloak';
  if (provider === 'mock') return 'mock';

  if (LEGACY_AUTH_MODE === 'temporary') return 'temporary';
  if (LEGACY_AUTH_MODE === 'keycloak') return 'keycloak';

  return 'mock';
}

export function usesDoqynAuth(): boolean {
  return getAuthProviderType() === 'doqyn_auth';
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

export function getAuthBasePath(): string {
  return import.meta.env.VITE_AUTH_BASE_PATH?.trim() || '/auth';
}
