import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AUTH_MODE } from '@/lib/constants';
import type { AuthUser } from './types';
import { loginRequest, logoutRequest, meRequest } from './authApi';
import { getAuthProvider, usesApiAuth } from './getAuthProvider';
import { mapSessionToAuthUser } from './sessionUser';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authMode: string;
  supportsSso: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithSSO: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isApiAuth = usesApiAuth();
  const clientProvider = useMemo(
    () => (isApiAuth ? null : getAuthProvider()),
    [isApiAuth],
  );

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);

    try {
      if (isApiAuth) {
        const currentUser = await meRequest();
        setUser(currentUser);
        return;
      }

      const session = clientProvider?.getSession() ?? null;
      setUser(session ? mapSessionToAuthUser(session) : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [clientProvider, isApiAuth]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      if (isApiAuth) {
        const loggedUser = await loginRequest({ email, password, rememberMe });
        setUser(loggedUser);
        return;
      }

      const session = await clientProvider!.login({ email, password });
      setUser(mapSessionToAuthUser(session));
    },
    [clientProvider, isApiAuth],
  );

  const loginWithSSO = useCallback(async () => {
    if (isApiAuth) {
      throw new Error('SSO disponível apenas com VITE_AUTH_MODE=keycloak.');
    }

    await clientProvider!.loginWithSSO();
  }, [clientProvider, isApiAuth]);

  const logout = useCallback(async () => {
    if (isApiAuth) {
      await logoutRequest();
    } else {
      await clientProvider!.logout();
    }
    setUser(null);
  }, [clientProvider, isApiAuth]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const supportsSso = AUTH_MODE === 'keycloak';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      authMode: AUTH_MODE,
      supportsSso,
      login,
      loginWithSSO,
      logout,
      refreshUser,
    }),
    [user, isLoading, supportsSso, login, loginWithSSO, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
