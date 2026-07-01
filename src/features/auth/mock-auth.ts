import type { AuthSession, LoginCredentials } from '@/types/user';
import type { AuthProvider } from './auth-provider';

const SESSION_KEY = 'doqyn_session';

const MOCK_USER = {
  id: 'user-001',
  email: 'admin@empresa.com',
  name: 'Administrador DOQYN',
  tenantId: 'tenant-001',
  roles: ['admin', 'document_manager'],
};

export class MockAuthProvider implements AuthProvider {
  login(credentials: LoginCredentials): Promise<AuthSession> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!credentials.email || !credentials.password) {
          reject(new Error('E-mail e senha são obrigatórios'));
          return;
        }

        const session: AuthSession = {
          user: { ...MOCK_USER, email: credentials.email },
          token: 'mock-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        resolve(session);
      }, 600);
    });
  }

  loginWithSSO(): Promise<AuthSession> {
    return Promise.reject(new Error('SSO não disponível. Use login por e-mail e senha.'));
  }

  logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    return Promise.resolve();
  }

  getSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      const session = JSON.parse(raw) as AuthSession;
      if (new Date(session.expiresAt) < new Date()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }
}
