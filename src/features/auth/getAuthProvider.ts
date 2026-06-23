import { AUTH_MODE } from '@/lib/constants';
import type { AuthProvider } from './auth-provider';
import { KeycloakAuthProvider } from './keycloak-auth';
import { MockAuthProvider } from './mock-auth';

let clientProvider: AuthProvider | null = null;

export function usesApiAuth(): boolean {
  return AUTH_MODE === 'temporary';
}

export function getAuthProvider(): AuthProvider {
  if (usesApiAuth()) {
    throw new Error('Modo temporary usa autenticação via API — não instancie AuthProvider cliente.');
  }

  if (!clientProvider) {
    clientProvider =
      AUTH_MODE === 'keycloak' ? new KeycloakAuthProvider() : new MockAuthProvider();
  }

  return clientProvider;
}
