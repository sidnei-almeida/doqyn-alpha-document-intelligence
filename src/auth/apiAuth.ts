import { usesDoqynAuth } from './authConfig';
import { shouldSetJsonContentType, withAuthHeaders } from './httpHeaders';

export { shouldSetJsonContentType, withAuthHeaders };

type TokenGetter = () => string | null;

let tokenGetter: TokenGetter | null = null;

export function registerAuthTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

export function getAccessToken(): string | null {
  return tokenGetter?.() ?? null;
}

export function getFetchCredentials(): RequestCredentials {
  return 'include';
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isFormData = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;

  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders(init?.headers, { json: !isFormData, hasBody }),
  });
}

export { usesDoqynAuth };
