export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  roles: string[];
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
