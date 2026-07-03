import { getAuthBasePath, usesDoqynAuth } from '@/auth/authConfig';
import { authFetch, getFetchCredentials } from '@/auth/apiAuth';
import { ApiError, parseApiError } from '@/lib/apiErrors';

export async function authServiceFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const base = getAuthBasePath();
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;

  return authFetch(url, {
    credentials: getFetchCredentials(),
    ...options,
  });
}

export async function authServiceJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await authServiceFetch(path, options);

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export function isDoqynAuthMode(): boolean {
  return usesDoqynAuth();
}

export { ApiError };
