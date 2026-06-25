import { getAuthBasePath, usesDoqynAuth } from '@/auth/authConfig';
import { authFetch, getFetchCredentials } from '@/auth/apiAuth';

export async function authServiceFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const base = getAuthBasePath();
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;

  return authFetch(url, {
    credentials: getFetchCredentials(),
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

export async function authServiceJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await authServiceFetch(path, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof (data as { message?: string }).message === 'string'
        ? (data as { message: string }).message
        : 'Erro na requisição ao auth-service.';
    throw new Error(message);
  }

  return data as T;
}

export function isDoqynAuthMode(): boolean {
  return usesDoqynAuth();
}
