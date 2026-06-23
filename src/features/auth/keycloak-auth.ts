import { KEYCLOAK_CONFIG } from '@/lib/constants';
import type { AuthSession, LoginCredentials } from '@/types/user';
import type { AuthProvider } from './auth-provider';

export class KeycloakAuthProvider implements AuthProvider {
  private get isConfigured(): boolean {
    return Boolean(
      KEYCLOAK_CONFIG.url && KEYCLOAK_CONFIG.realm && KEYCLOAK_CONFIG.clientId,
    );
  }

  login(credentials: LoginCredentials): Promise<AuthSession> {
    void credentials;
    if (!this.isConfigured) {
      return Promise.reject(new Error('Keycloak não configurado. Verifique as variáveis de ambiente.'));
    }
    // Future: redirect to Keycloak login page or use keycloak-js adapter
    return Promise.reject(new Error('Login por credenciais via Keycloak será implementado na próxima fase.'));
  }

  loginWithSSO(): Promise<AuthSession> {
    if (!this.isConfigured) {
      return Promise.reject(new Error('Keycloak não configurado. Verifique as variáveis de ambiente.'));
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/dashboard');
    const authUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CONFIG.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid`;
    window.location.href = authUrl;
    return new Promise(() => {});
  }

  logout(): Promise<void> {
    localStorage.removeItem('doqyn_session');
    if (this.isConfigured) {
      const logoutUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/logout`;
      window.location.href = logoutUrl;
    }
    return Promise.resolve();
  }

  getSession(): AuthSession | null {
    const raw = localStorage.getItem('doqyn_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
}
