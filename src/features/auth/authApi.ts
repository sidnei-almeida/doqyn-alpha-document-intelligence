import type { AuthUser } from './types';

type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

type AuthResponse = {
  user: AuthUser;
};

async function parseError(response: Response) {
  try {
    const data = await response.json();
    return data?.error || 'Erro inesperado';
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
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as AuthResponse;

  return data.user;
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
