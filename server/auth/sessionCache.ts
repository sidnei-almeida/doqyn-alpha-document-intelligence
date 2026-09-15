import { createHash } from 'node:crypto';
import type { DoqynVerifiedSession } from './providers/doqynAuthProvider.js';
import { redisDel, redisGetJson, redisSetJson } from '../redis/redisClient.js';

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function isSessionCacheEnabled(): boolean {
  return readBool(process.env.SESSION_CACHE_ENABLED, true);
}

export function getSessionCacheTtlSeconds(): number {
  return readPositiveInt(process.env.SESSION_CACHE_TTL_SECONDS, 45);
}

function buildSessionCacheKey(sessionToken: string): string {
  const digest = createHash('sha256').update(sessionToken).digest('hex');
  return `session:${digest}`;
}

export async function getCachedDoqynSession(
  sessionToken: string,
): Promise<DoqynVerifiedSession | null> {
  if (!isSessionCacheEnabled()) return null;
  return redisGetJson<DoqynVerifiedSession>(buildSessionCacheKey(sessionToken));
}

export async function setCachedDoqynSession(
  sessionToken: string,
  session: DoqynVerifiedSession,
): Promise<void> {
  if (!isSessionCacheEnabled()) return;
  await redisSetJson(buildSessionCacheKey(sessionToken), session, getSessionCacheTtlSeconds());
}

/**
 * Esquece a sessão em cache para que a próxima requisição releia o auth-service.
 *
 * Existe por causa do idioma. A sessão fica em cache por 45 segundos, e dentro dessa janela o
 * `AuthUser` guardado ainda carrega o locale antigo — então alguém que acabou de mudar para
 * inglês podia disparar um compartilhamento e ver o e-mail sair em português. Quarenta e cinco
 * segundos é pouco, mas é exatamente o intervalo em que a pessoa está testando se a troca
 * funcionou.
 *
 * Serve para qualquer dado de sessão que o usuário edita e vê de volta — nome, avatar, papel —,
 * não só para o idioma.
 */
export async function invalidateCachedDoqynSession(sessionToken: string): Promise<void> {
  if (!isSessionCacheEnabled()) return;
  await redisDel(buildSessionCacheKey(sessionToken));
}
