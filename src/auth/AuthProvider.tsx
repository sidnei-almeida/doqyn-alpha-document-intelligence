import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/features/auth/types';
import { loginRequest, logoutRequest } from '@/features/auth/authApi';
import { registerAuthTokenGetter } from '@/auth/apiAuth';
import { AccessGateScreen } from '@/auth/AccessGateScreen';
import { mapMeSessionToAuthUser, resolveAccessGate } from '@/auth/mapMeSession';
import { getCurrentSession, SessionApiError } from '@/auth/sessionApi';
import { ApiError, shouldLogoutForError } from '@/lib/apiErrors';
import type { AccessGateReason, MeMembership, MeTenant } from '@/auth/sessionTypes';
import { AuthContext, type AuthContextValue } from '@/auth/authContext';
import { redirectToOAuth } from '@/auth/oauthLogin';
import { clearPreviewCachesForTenant } from '@/features/documents/preview/clearPreviewCaches';
import { clearSessionScopedCaches } from '@/auth/clearSessionScopedCaches';
import { buildSessionFingerprintFromAuth } from '@/auth/sessionFingerprint';
import { queryClient } from '@/app/queryClient';
import { refetchTenantScopedQueries } from '@/features/tenant/tenantLiveSync';
import { i18n } from '@/i18n';

const PUBLIC_UNAUTHENTICATED_PATHS = [
  '/access',
  '/signup/company',
  '/signup/individual',
  '/onboarding',
];

/**
 * `/sso/callback` fica de fora de PUBLIC_UNAUTHENTICATED_PATHS de propósito: a única função
 * daquela página é carregar a sessão recém-criada pelo provedor. Tratá-la como rota anônima
 * fazia o `refreshUser()` apagar a sessão no instante seguinte ao login, e o usuário era
 * mandado de volta ao formulário de login com o servidor já tendo registrado sucesso.
 * Continua no bypass do access gate abaixo, porque quem chega ali ainda pode não ter
 * membership.
 *
 * `/invite` segue a mesma lógica. Conta que já existe só aceita convite logada nela, então a
 * página precisa da sessão para decidir entre o formulário, "entre para aceitar" e "troque de
 * conta". E fica no bypass porque quem aceita pode ainda não ter empresa nenhuma.
 */
const ACCESS_GATE_BYPASS_PATHS = ['/onboarding', '/sso/callback', '/invite'];

function applyPartialUserFromSessionError(
  err: SessionApiError,
  setUser: (user: AuthUser | null) => void,
) {
  if (!err.partialUser?.email) return;

  const displayName =
    [err.partialUser.firstName, err.partialUser.lastName].filter(Boolean).join(' ') ||
    err.partialUser.email;

  setUser({
    id: err.partialUser.id ?? err.partialUser.email,
    email: err.partialUser.email,
    name: displayName,
    username: err.partialUser.username,
    firstName: err.partialUser.firstName,
    lastName: err.partialUser.lastName,
    companyId: '',
    companyName: '',
    role: 'user',
    area: '',
    groups: [],
    roles: [],
  });
}

function isPublicUnauthenticatedPath(): boolean {
  if (typeof window === 'undefined') return false;
  return PUBLIC_UNAUTHENTICATED_PATHS.some((path) => window.location.pathname.startsWith(path));
}

function shouldBypassAccessGate(): boolean {
  if (typeof window === 'undefined') return false;
  return ACCESS_GATE_BYPASS_PATHS.some((path) => window.location.pathname.startsWith(path));
}

function logSessionLoaded(input: {
  meOk: boolean;
  tenantId?: string;
  membershipStatus?: string;
  tenantRoles?: string[];
}) {
  if (!import.meta.env.DEV) return;
  console.info('[auth] sessão carregada', input);
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
    meOk: true,
    tenantId: session.tenant.tenantId,
    membershipStatus: session.membership.status,
    tenantRoles: session.membership.tenantRoles,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<MeTenant | null>(null);
  const [membership, setMembership] = useState<MeMembership | null>(null);
  const [accessGate, setAccessGate] = useState<AccessGateReason | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const previousTenantIdRef = useRef<string | null>(null);
  const sessionFingerprintRef = useRef<string | null>(null);

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
    sessionFingerprintRef.current = null;
    clearSessionScopedCaches();
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
      if (err instanceof SessionApiError) {
        if (err.accessGate) {
          applyPartialUserFromSessionError(err, setUser);
          setTenant(null);
          setMembership(null);
          setAccessGate(err.accessGate);
          setError(err.friendlyMessage);
          throw err;
        }

        if (shouldLogoutForError(err.code) || err.status === 401) {
          clearSession();
          setError(err.friendlyMessage);
          return;
        }
      }

      if (err instanceof ApiError && err.status === 403) {
        setError(err.friendlyMessage);
        return;
      }

      clearSession();
      throw err;
    }
  }, [clearSession, sessionSetters]);

  const refreshToken = useCallback(async () => {
    // Token refresh não aplicável em doqyn_auth (cookie HttpOnly).
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAccessGate(null);

    try {
      if (isPublicUnauthenticatedPath()) {
        clearSession();
        return;
      }
      await loadDoqynSession();
    } catch (err) {
      if (err instanceof SessionApiError && err.accessGate) {
        setError(err.friendlyMessage);
        return;
      }

      clearSession();
      if (err instanceof ApiError) {
        setError(err.friendlyMessage);
      } else {
        setError(err instanceof Error ? err.message : i18n.t('common:accessGate.authFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearSession, loadDoqynSession]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      clearSessionScopedCaches();
      await loginRequest({ email, password, rememberMe });
      await loadDoqynSession();
    },
    [loadDoqynSession],
  );

  const loginWithGoogle = useCallback((returnUrl?: string) => {
    redirectToOAuth('google', returnUrl);
  }, []);

  const loginWithMicrosoft = useCallback((returnUrl?: string) => {
    redirectToOAuth('microsoft', returnUrl);
  }, []);

  const loginWithSSO = useCallback(async () => {
    loginWithGoogle();
  }, [loginWithGoogle]);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearSession();
  }, [clearSession]);

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);

  const hasAnyRole = useCallback(
    (checkRoles: readonly string[]) => checkRoles.some((role) => roles.includes(role)),
    [roles],
  );

  const retryAuth = useCallback(() => {
    setInitAttempt((value) => value + 1);
  }, []);

  const syncSessionIfChanged = useCallback(async () => {
    if (isPublicUnauthenticatedPath()) return;

    try {
      const session = await getCurrentSession();
      const nextFingerprint = buildSessionFingerprintFromAuth({
        user: mapMeSessionToAuthUser(session),
        tenant: session.tenant,
        membership: session.membership,
      });
      const previousFingerprint = sessionFingerprintRef.current;

      if (previousFingerprint && nextFingerprint && previousFingerprint !== nextFingerprint) {
        clearSessionScopedCaches();
      }

      applyMeSession(session, sessionSetters);
      setError(null);

      if (session.tenant.tenantId) {
        void refetchTenantScopedQueries(queryClient, session.tenant.tenantId);
      }
    } catch (err) {
      if (err instanceof SessionApiError && err.accessGate) {
        applyPartialUserFromSessionError(err, setUser);
        setTenant(null);
        setMembership(null);
        setAccessGate(err.accessGate);
        sessionFingerprintRef.current = null;
        clearSessionScopedCaches();
        setError(err.friendlyMessage);
        return;
      }

      if (
        err instanceof SessionApiError &&
        (shouldLogoutForError(err.code) || err.status === 401)
      ) {
        clearSession();
        setError(err.friendlyMessage);
      }
    }
  }, [clearSession, sessionSetters]);

  useEffect(() => {
    registerAuthTokenGetter(null);
    return () => registerAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser, initAttempt]);

  useEffect(() => {
    const current = buildSessionFingerprintFromAuth({ user, tenant, membership });
    const previous = sessionFingerprintRef.current;

    if (previous && current && previous !== current) {
      clearSessionScopedCaches();
    }

    sessionFingerprintRef.current = current;
  }, [user, tenant, membership]);

  useEffect(() => {
    if (!user || accessGate) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void syncSessionIfChanged();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [accessGate, syncSessionIfChanged, user]);

  useEffect(() => {
    const currentTenantId = tenant?.tenantId ?? null;
    const previousTenantId = previousTenantIdRef.current;
    if (previousTenantId && currentTenantId && previousTenantId !== currentTenantId) {
      clearPreviewCachesForTenant(previousTenantId);
      clearSessionScopedCaches();
    }
    previousTenantIdRef.current = currentTenantId;
  }, [tenant?.tenantId]);

  const supportsSso = false;
  const isAuthenticated = Boolean(user) && !accessGate;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tenant,
      membership,
      token: null,
      roles,
      accessGroupIds,
      accessGate,
      isAuthenticated,
      isLoading,
      error,
      supportsSso,
      login,
      loginWithSSO,
      loginWithGoogle,
      loginWithMicrosoft,
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
      roles,
      accessGroupIds,
      accessGate,
      isAuthenticated,
      isLoading,
      error,
      supportsSso,
      login,
      loginWithSSO,
      loginWithGoogle,
      loginWithMicrosoft,
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
        {i18n.t('common:accessGate.checking')}
      </div>
    );
  }

  if (accessGate && !shouldBypassAccessGate()) {
    return (
      <AuthContext.Provider value={value}>
        <AccessGateScreen
          reason={accessGate}
          email={user?.email}
          tenantName={tenant?.displayName}
          message={error ?? undefined}
          onLogout={() => void logout()}
        />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
