import { getRedisClient } from '../../redis/redisClient.js';
import { prefixRedisKey } from '../../redis/redisConfig.js';
import { logger } from '../../utils/logger.js';

/**
 * Limites reais da conta Groq, lidos da própria resposta.
 *
 * Os padrões do limitador são chute conservador dimensionado para o plano gratuito, e chute
 * conservador cobra caro: com teto baixo demais o pedido espera a virada do minuto por uma vaga que
 * a conta tinha de sobra. A Groq manda os limites em cabeçalho de toda resposta — não precisa
 * adivinhar, e ao trocar de plano o número se ajusta sozinho, sem ninguém lembrar de editar `.env`.
 *
 * O que fica guardado é por modelo, porque a cota da Groq é por modelo.
 */
const OBSERVED_TTL_SECONDS = 3_600;
/** Releitura do Redis. O limite muda de plano, não de segundo. */
const LOCAL_CACHE_MS = 15_000;

export type ObservedGroqLimits = {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
};

const localCache = new Map<string, { value: ObservedGroqLimits | null; expiresAt: number }>();

function observedKey(model: string): string {
  return prefixRedisKey(`groq:limits:${model}`);
}

/**
 * Cabeçalhos vêm por minuto **ou** por dia, dependendo da conta: `x-ratelimit-limit-tokens` é o da
 * janela de minuto; o diário aparece em `-tokens-day`, que não interessa aqui. Números fora de
 * faixa são ignorados em vez de virar teto absurdo.
 */
function readHeaderNumber(headers: Headers | undefined, name: string): number | undefined {
  const raw = headers?.get(name);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

export function parseGroqLimitHeaders(headers: Headers | undefined): ObservedGroqLimits | null {
  const requestsPerMinute = readHeaderNumber(headers, 'x-ratelimit-limit-requests');
  const tokensPerMinute = readHeaderNumber(headers, 'x-ratelimit-limit-tokens');

  if (!requestsPerMinute && !tokensPerMinute) return null;
  return { requestsPerMinute, tokensPerMinute };
}

export async function rememberGroqLimits(model: string, limits: ObservedGroqLimits): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const previous = localCache.get(model)?.value;
  await client.set(observedKey(model), JSON.stringify(limits), 'EX', OBSERVED_TTL_SECONDS);
  localCache.set(model, { value: limits, expiresAt: Date.now() + LOCAL_CACHE_MS });

  if (
    previous?.requestsPerMinute !== limits.requestsPerMinute ||
    previous?.tokensPerMinute !== limits.tokensPerMinute
  ) {
    logger.info('groq_limits_observed', {
      model,
      requestsPerMinute: limits.requestsPerMinute,
      tokensPerMinute: limits.tokensPerMinute,
    });
  }
}

export async function getObservedGroqLimits(model: string): Promise<ObservedGroqLimits | null> {
  const cached = localCache.get(model);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = await getRedisClient();
  if (!client) return null;

  const raw = await client.get(observedKey(model));
  const value = raw ? (JSON.parse(raw) as ObservedGroqLimits) : null;
  localCache.set(model, { value, expiresAt: Date.now() + LOCAL_CACHE_MS });
  return value;
}

/** Só para teste: o cache de processo não pode atravessar cenários. */
export function resetObservedGroqLimitsCache(): void {
  localCache.clear();
}
