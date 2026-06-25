import { getAuthProviderType } from '@/auth/authConfig';
import type { AuthProvider } from './auth-provider';
import { KeycloakAuthProvider } from './keycloak-auth';
import { MockAuthProvider } from './mock-auth';

let clientProvider: AuthProvider | null = null;

export function usesApiAuth(): boolean {
  return getAuthProviderType() === 'temporary';
}

export function getAuthProvider(): AuthProvider {
  const providerType = getAuthProviderType();

  if (providerType === 'temporary' || providerType === 'keycloak' || providerType === 'mock') {
    throw new Error(
      `Provider "${providerType}" é gerenciado pelo AuthProvider central — não instancie AuthProvider legado.`,
    );
  }

  if (!clientProvider) {
    clientProvider = new MockAuthProvider();
  }

  return clientProvider;
}

/** @deprecated use getAuthProviderType from @/auth */
export function getLegacyAuthProvider(): AuthProvider {
  if (!clientProvider) {
    clientProvider =
      getAuthProviderType() === 'keycloak'
        ? new KeycloakAuthProvider()
        : new MockAuthProvider();
  }
  return clientProvider;
}
