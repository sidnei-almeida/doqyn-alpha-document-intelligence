import Keycloak from 'keycloak-js';
import { KEYCLOAK_CONFIG } from '@/lib/constants';

let keycloakInstance: Keycloak | null = null;
let initPromise: Promise<Keycloak> | null = null;

export function isKeycloakClientConfigured(): boolean {
  return Boolean(
    KEYCLOAK_CONFIG.url && KEYCLOAK_CONFIG.realm && KEYCLOAK_CONFIG.clientId,
  );
}

function createKeycloakInstance(): Keycloak {
  return new Keycloak({
    url: KEYCLOAK_CONFIG.url,
    realm: KEYCLOAK_CONFIG.realm,
    clientId: KEYCLOAK_CONFIG.clientId,
  });
}

export async function initKeycloak(): Promise<Keycloak> {
  if (!isKeycloakClientConfigured()) {
    throw new Error(
      'Keycloak não configurado. Defina VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM e VITE_KEYCLOAK_CLIENT_ID.',
    );
  }

  if (keycloakInstance?.authenticated) {
    return keycloakInstance;
  }

  if (!initPromise) {
    const instance = createKeycloakInstance();

    initPromise = instance
      .init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then((authenticated) => {
        if (!authenticated) {
          throw new Error('Autenticação Keycloak não concluída.');
        }

        keycloakInstance = instance;

        instance.onTokenExpired = () => {
          void instance.updateToken(30).catch(() => {
            void instance.login();
          });
        };

        return instance;
      })
      .catch((error) => {
        initPromise = null;
        throw error;
      });
  }

  return initPromise;
}

export function getKeycloak(): Keycloak | null {
  return keycloakInstance;
}

export function resetKeycloakClient(): void {
  keycloakInstance = null;
  initPromise = null;
}

export function getKeycloakLogoutRedirectUri(): string {
  return import.meta.env.VITE_KEYCLOAK_LOGOUT_REDIRECT_URI?.trim() || 'http://localhost:5173';
}
