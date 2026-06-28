import { createContext } from 'react';
import type { AuthUser } from '@/features/auth/types';
import type { getAuthProviderType } from '@/auth/authConfig';
import type { AccessGateReason, MeMembership, MeTenant } from '@/auth/sessionTypes';

export type AuthContextValue = {
  user: AuthUser | null;
  tenant: MeTenant | null;
  membership: MeMembership | null;
  token: string | null;
  roles: string[];
  accessGroupIds: string[];
  accessGate: AccessGateReason | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authMode: string;
  authProvider: ReturnType<typeof getAuthProviderType>;
  supportsSso: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithSSO: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (checkRoles: string[]) => boolean;
  retryAuth: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
