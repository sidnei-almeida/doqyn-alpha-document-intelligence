export type AuthProviderName = 'doqyn_auth' | 'temporary';

export function getAuthProvider(): AuthProviderName {
  const provider = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (provider === 'doqyn_auth') return 'doqyn_auth';
  return 'temporary';
}

export function usesDoqynAuth(): boolean {
  return getAuthProvider() === 'doqyn_auth';
}

export function getDoqynAuthBaseUrl(): string {
  return process.env.DOQYN_AUTH_BASE_URL?.trim() || 'http://127.0.0.1:4100';
}

export function getDoqynAuthInternalApiKey(): string {
  const key = process.env.DOQYN_AUTH_INTERNAL_API_KEY?.trim();
  if (!key) {
    throw new Error('DOQYN_AUTH_INTERNAL_API_KEY is required when AUTH_PROVIDER=doqyn_auth');
  }
  return key;
}

export function getDoqynAuthCookieName(): string {
  return process.env.DOQYN_AUTH_COOKIE_NAME?.trim() || 'doqyn_session';
}

export function isSessionCacheEnabled(): boolean {
  const raw = process.env.SESSION_CACHE_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

export function getSessionCacheTtlSeconds(): number {
  const parsed = Number(process.env.SESSION_CACHE_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 45;
  return Math.floor(parsed);
}
