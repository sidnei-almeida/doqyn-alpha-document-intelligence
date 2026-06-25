import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AUTH_MODE } from '@/lib/constants';
import type { AuthUser } from '@/features/auth/types';
import { loginRequest, logoutRequest, doqynMeRequest } from '@/features/auth/authApi';
import { registerAuthTokenGetter } from '@/auth/apiAuth';
import {
  getAuthProviderType,
  usesDoqynAuth,
  usesKeycloakAuth,
} from '@/auth/authConfig';
import { AccessGateScreen } from '@/auth/AccessGateScreen';
import { mapMeSessionToAuthUser, resolveAccessGate } from '@/auth/mapMeSession';
import { getCurrentSession, SessionApiError } from '@/auth/sessionApi';
import type { AccessGateReason, MeMembership, MeTenant } from '@/auth/sessionTypes';

const PUBLIC_UNAUTHENTICATED_PATHS = [
  '/acesso',
  '/solicitar-acesso',
  '/criar-empresa',
  '/criar-acesso-cpf',
];

function isPublicUnauthenticatedPath(): boolean {
  if (typeof window === 'undefined') return false;
  return PUBLIC_UNAUTHENTICATED_PATHS.some((path) => window.location.pathname.startsWith(path));
}

const MOCK_DEV_USER: AuthUser = {
  id: 'user_dev_mock',
  email: 'dev@doqyn.com',
  name: 'Desenvolvedor DOQYN (mock)',
  username: 'dev',
  companyId: 'company_dev',
  companyName: 'DOQYN Dev',
  role: 'admin',
  area: 'Gestão',
  groups: ['admin', 'juridico', 'financeiro'],
  roles: ['doqyn_admin', 'company_admin', 'user'],
};

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

function logSessionLoaded(input: {
  authProvider: string;
  meOk: boolean;
  tenantId?: string;
  membershipStatus?: string;
  tenantRoles?: string[];
}) {
  if (!import.meta.env.DEV) return;
  console.info('[auth] sessão carregada', input);
}

function AuthErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-doqyn-bg px-6 text-center">
      <p className="max-w-md text-sm text-doqyn-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-doqyn-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );
}

function applyMeSession(
  session: Awaited<ReturnType<typeof getCurrentSession>>,
  setters: {
    setUser: (user: AuthUser | null) => void;
    setTenant: (tenant: MeTenant | null) => void;
    setMembership: (membership: MeMembership | null) => void;
    setAccessGate: (gate: AccessGateReason | null) => void;
  },
) {
  const authUser = mapMeSessionToAuthUser(session);
  const gate = resolveAccessGate(session.membership);

  setters.setUser(authUser);
  setters.setTenant(session.tenant);
  setters.setMembership(session.membership);
  setters.setAccessGate(gate);

  logSessionLoaded({
    authProvider: getAuthProviderType(),
    meOk: true,
    tenantId: session.tenant.tenantId,
    membershipStatus: session.membership.status,
    tenantRoles: session.membership.tenantRoles,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authProvider = getAuthProviderType();
  const isDoqynAuth = usesDoqynAuth();
  const isApiAuth = authProvider === 'temporary';
  const isKeycloak = usesKeycloakAuth();
  const isMock = authProvider === 'mock';

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<MeTenant | null>(null);
  const [membership, setMembership] = useState<MeMembership | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGateReason | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const roles = useMemo(
    () => membership?.tenantRoles ?? user?.roles ?? user?.groups ?? [],
    [membership, user],
  );

  const accessGroupIds = useMemo(
    () => membership?.accessGroupIds ?? user?.groups ?? [],
    [membership, user],
  );

  const clearSession = useCallback(() => {
    setUser(null);
    setTenant(null);
    setMembership(null);
    setAccessGate(null);
    setToken(null);
  }, []);

  const sessionSetters = useMemo(
    () => ({
      setUser,
      setTenant,
      setMembership,
      setAccessGate,
    }),
    [],
  );

  const loadDoqynSession = useCallback(async () => {
    try {
      const session = await getCurrentSession();
      applyMeSession(session, sessionSetters);
      setError(null);
    } catch (err) {
      clearSession();

      if (err instanceof SessionApiError) {
        if (err.code === 'NO_ACTIVE_MEMBERSHIP') {
          setAccessGate('no_membership');
          setError(null);
          return;
        }
        if (err.statusCode === 401) {
          setError(null);
          return;
        }
      }

      throw err;
    }
  }, [clearSession, sessionSetters]);

  const loadKeycloakSession = useCallback(async () => {
    throw new Error('Keycloak foi descontinuado. Use VITE_AUTH_PROVIDER=doqyn_auth.');
  }, []);

  const refreshToken = useCallback(async () => {
    // Token refresh não aplicável em doqyn_auth (cookie HttpOnly).
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAccessGate(null);

    try {
      if (isDoqynAuth) {
        if (isPublicUnauthenticatedPath()) {
          clearSession();
          return;
        }
        await loadDoqynSession();
        return;
      }

      if (isKeycloak) {
        if (isPublicUnauthenticatedPath()) {
          clearSession();
          return;
        }
        await loadKeycloakSession();
        return;
      }

      if (isMock) {
        setUser(MOCK_DEV_USER);
        setTenant({
          tenantId: MOCK_DEV_USER.companyId,
          tenantType: 'business',
          displayName: MOCK_DEV_USER.companyName,
          status: 'active',
        });
        setMembership({
          status: 'active',
          tenantRoles: MOCK_DEV_USER.roles ?? [],
          accessGroupIds: MOCK_DEV_USER.groups,
        });
        setToken(null);
        return;
      }

      if (isApiAuth) {
        const session = await doqynMeRequest().catch(() => null);
        if (session) {
          applyMeSession(session, sessionSetters);
        } else {
          clearSession();
        }
        setToken(null);
        return;
      }

      clearSession();
    } catch (err) {
      clearSession();
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, isApiAuth, isDoqynAuth, isKeycloak, isMock, loadDoqynSession, loadKeycloakSession]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      if (isKeycloak) {
        throw new Error('Keycloak descontinuado. Configure VITE_AUTH_PROVIDER=doqyn_auth.');
      }

      if (isMock) {
        setUser({ ...MOCK_DEV_USER, email });
        return;
      }

      if (isDoqynAuth || isApiAuth) {
        await loginRequest({ email, password, rememberMe });
        if (isDoqynAuth) {
          await loadDoqynSession();
        } else {
          const session = await doqynMeRequest();
          if (session) applyMeSession(session, sessionSetters);
        }
        return;
      }
    },
    [isApiAuth, isDoqynAuth, isKeycloak, isMock, loadDoqynSession],
  );

  const loginWithSSO = useCallback(async () => {
    throw new Error('SSO Keycloak descontinuado. Use login por e-mail e senha.');
  }, []);

  const logout = useCallback(async () => {
    if (isKeycloak) {
      clearSession();
      return;
    }

    if (isMock) {
      clearSession();
      return;
    }

    if (isDoqynAuth || isApiAuth) {
      await logoutRequest();
    }

    clearSession();
  }, [clearSession, isApiAuth, isDoqynAuth, isKeycloak, isMock]);

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);

  const hasAnyRole = useCallback(
    (checkRoles: string[]) => checkRoles.some((role) => roles.includes(role)),
    [roles],
  );

  const retryAuth = useCallback(() => {
    setInitAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    registerAuthTokenGetter(() => (usesKeycloakAuth() ? token : null));
    return () => registerAuthTokenGetter(null);
  }, [token]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser, initAttempt]);

  const supportsSso = false;
  const isAuthenticated = Boolean(user) && !accessGate;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tenant,
      membership,
      token,
      roles,
      accessGroupIds,
      accessGate,
      isAuthenticated,
      isLoading,
      error,
      authMode: AUTH_MODE,
      authProvider,
      supportsSso,
      login,
      loginWithSSO,
      logout,
      refreshUser,
      refreshToken,
      hasRole,
      hasAnyRole,
      retryAuth,
    }),
    [
      user,
      tenant,
      membership,
      token,
      roles,
      accessGroupIds,
      accessGate,
      isAuthenticated,
      isLoading,
      error,
      authProvider,
      supportsSso,
      login,
      loginWithSSO,
      logout,
      refreshUser,
      refreshToken,
      hasRole,
      hasAnyRole,
      retryAuth,
    ],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        Verificando acesso...
      </div>
    );
  }

  if (accessGate) {
    return (
      <AuthContext.Provider value={value}>
        <AccessGateScreen
          reason={accessGate}
          email={user?.email}
          tenantName={tenant?.displayName}
          onLogout={() => void logout()}
        />
      </AuthContext.Provider>
    );
  }

  if (error && isKeycloak) {
    return <AuthErrorScreen message={error} onRetry={retryAuth} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
