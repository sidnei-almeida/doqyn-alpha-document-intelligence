import { getAuthBasePath } from '@/auth/authConfig';
import { authFetch } from '@/auth/apiAuth';
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

export async function logoutRequest(): Promise<void> {
  await doqynLogoutRequest();
}

export { ApiError };
