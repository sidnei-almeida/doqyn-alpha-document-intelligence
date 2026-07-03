import { getAuthBasePath, usesDoqynAuth } from '@/auth/authConfig';
import { authFetch, getFetchCredentials } from '@/auth/apiAuth';
import { mapMeSessionToAuthUser } from '@/auth/mapMeSession';
import type { AuthUser } from '@/features/auth/types';
import type { MeSession } from '@/auth/sessionTypes';
import { ApiError, parseApiError } from '@/lib/apiErrors';

type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export async function doqynLoginRequest(input: LoginInput): Promise<void> {
  const base = getAuthBasePath();
  const response = await fetch(`${base}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, password: input.password }),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export async function doqynLogoutRequest(): Promise<void> {
  const base = getAuthBasePath();
  const response = await fetch(`${base}/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export async function doqynMeRequest(): Promise<MeSession | null> {
  const response = await authFetch('/api/me', { method: 'GET' });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as MeSession;
}

export async function loginRequest(input: LoginInput): Promise<AuthUser> {
  if (usesDoqynAuth()) {
    await doqynLoginRequest(input);
    const session = await doqynMeRequest();
    if (!session) {
      throw new ApiError({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Não foi possível carregar a sessão após login.',
      });
    }
    return mapMeSessionToAuthUser(session);
  }

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function meRequest(): Promise<AuthUser | null> {
  if (usesDoqynAuth()) {
    const session = await doqynMeRequest();
    return session ? mapMeSessionToAuthUser(session) : null;
  }

  const response = await authFetch('/api/auth/me', { method: 'GET' });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const data = (await response.json()) as MeSession & { legacyUser?: AuthUser };

  if (data.legacyUser) {
    return data.legacyUser;
  }

  if (data.user && data.tenant && data.membership) {
    return mapMeSessionToAuthUser(data);
  }

  return (data as unknown as { user: AuthUser }).user ?? null;
}

export async function logoutRequest(): Promise<void> {
  if (usesDoqynAuth()) {
    await doqynLogoutRequest();
    return;
  }

  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: getFetchCredentials(),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export { ApiError };
