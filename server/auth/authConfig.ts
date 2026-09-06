/**
 * O DOQYN tem um provedor de autenticação, e é o auth-service.
 *
 * Houve um segundo — `AUTH_PROVIDER=temporary`, um admin fixo em variável de ambiente com JWT
 * local, de antes de o auth-service existir. Ele saiu inteiro: enquanto os dois conviviam, cada
 * chamada a `usesDoqynAuth()` era um `if` no caminho de autenticação e de resolução de tenant, e
 * lá um ramo errado não dá erro — dá acesso.
 */

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
