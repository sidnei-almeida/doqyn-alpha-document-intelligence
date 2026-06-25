import { usesKeycloakAuth } from './authConfig';

type TokenGetter = () => string | null;

let tokenGetter: TokenGetter | null = null;

export function registerAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export function getAccessToken(): string | null {
  return tokenGetter?.() ?? null;
}

export function withAuthHeaders(
  headers?: HeadersInit,
  options?: { json?: boolean },
): HeadersInit {
  const merged = new Headers(headers);

  if (options?.json !== false && !merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }

  if (usesKeycloakAuth()) {
    const token = getAccessToken();
    if (token) {
      merged.set('Authorization', `Bearer ${token}`);
    }
  }

  return merged;
}

export function getFetchCredentials(): RequestCredentials {
  return usesKeycloakAuth() ? 'same-origin' : 'include';
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isFormData = init?.body instanceof FormData;

  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders(init?.headers, { json: !isFormData }),
  });
}
