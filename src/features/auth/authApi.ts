import type { AuthUser } from './types';
import { authFetch } from '@/auth/apiAuth';
import { mapMeSessionToAuthUser } from '@/auth/mapMeSession';
import type { MeSession } from '@/auth/sessionTypes';

type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

type AuthResponse = {
  user: AuthUser;
};

type MeApiResponse = MeSession & {
  legacyUser?: AuthUser;
};

async function parseError(response: Response) {
  try {
    const data = await response.json();
    return data?.message || data?.error || 'Erro inesperado';
  } catch {
    return 'Erro inesperado';
  }
}

export async function loginRequest(input: LoginInput): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as AuthResponse;

  return data.user;
}

export async function meRequest(): Promise<AuthUser | null> {
  const response = await authFetch('/api/auth/me', {
    method: 'GET',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as MeApiResponse;

  if (data.legacyUser) {
    return data.legacyUser;
  }

  if (data.user && data.tenant && data.membership) {
    return mapMeSessionToAuthUser(data);
  }

  return (data as unknown as AuthResponse).user ?? null;
}

export async function logoutRequest(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
