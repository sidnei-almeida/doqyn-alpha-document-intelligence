import type { AuthSession, LoginCredentials } from '@/types/user';

export interface AuthProvider {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  loginWithSSO(): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): AuthSession | null;
  isAuthenticated(): boolean;
}
