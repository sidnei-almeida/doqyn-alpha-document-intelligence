import { getRedisClient } from '../../redis/redisClient.js';
import { prefixRedisKey } from '../../redis/redisConfig.js';
import { logger } from '../../utils/logger.js';

/**
 * Vazão da conta Groq, compartilhada por todos os workers.
 *
 * O tratamento de 429 que já existia é por requisição: o pedido sai, leva erro, e o documento cai
 * em `ai_paused` esperando ação humana. Isso segura enquanto a fila roda 2 análises por vez; com
 * concorrência alta vira o modo de falha padrão, e o cliente vê "IA indisponível" no lote inteiro.
 *
 * Aqui o pedido **espera a vez** em vez de tomar 429. O contador vive no Redis porque o limite é da
 * conta, não do processo: dois workers com limite local de 15 estouram um teto de 20 sem nunca
 * saber um do outro.
 *
 * Sem Redis não há limitação — mesmo critério do resto do sistema em desenvolvimento.
 */

/**
 * Padrões dimensionados para o **plano gratuito**, que é o que está em uso hoje, e por modelo.
 *
 * Errar para baixo aqui custa fila; errar para cima custa 429 e documento parado esperando ação
 * humana. Ao contratar plano pago, suba pelos números do contrato — os limites reais aparecem nos
 * cabeçalhos `x-ratelimit-limit-requests` e `x-ratelimit-limit-tokens` de qualquer resposta da
 * Groq, então não precisa ser adivinhação.
 */
const DEFAULT_REQUESTS_PER_MINUTE = 25;
const DEFAULT_TOKENS_PER_MINUTE = 6_000;
/**
 * Teto de espera. Precisa ser maior que a janela: um pedido que chega logo depois de a janela
 * saturar espera o minuto quase inteiro, e um teto menor que isso transformaria em erro justamente
 * o caso que este módulo existe para absorver. O custo é um slot de worker parado até a virada —
 * aceitável porque a espera vem em vez de um documento em "IA indisponível".
 */
const DEFAULT_MAX_WAIT_MS = 75_000;
const WINDOW_MS = 60_000;

export type GroqSlotRequest = {
  /** Estimativa de tokens do pedido, entrada mais saída. */
  estimatedTokens: number;
  operation: string;
  /**
   * O limite da Groq é **por modelo**, não por conta. Classificação (70b) e extração (8b) têm
   * cotas separadas, então contá-las no mesmo balde jogaria fora metade da capacidade.
   */
  model: string;
};

export class GroqRateLimitWaitTimeout extends Error {
  readonly code = 'GROQ_LOCAL_RATE_LIMIT';

  constructor(waitedMs: number) {
    super(`Vazão da Groq saturada: esperou ${waitedMs}ms por uma vaga.`);
    this.name = 'GroqRateLimitWaitTimeout';
  }
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getGroqRequestsPerMinute(): number {
  return readPositiveInt(process.env.GROQ_MAX_REQUESTS_PER_MINUTE, DEFAULT_REQUESTS_PER_MINUTE);
}

export function getGroqTokensPerMinute(): number {
  return readPositiveInt(process.env.GROQ_MAX_TOKENS_PER_MINUTE, DEFAULT_TOKENS_PER_MINUTE);
}

export function getGroqRateLimitMaxWaitMs(): number {
  return readPositiveInt(process.env.GROQ_RATE_LIMIT_MAX_WAIT_MS, DEFAULT_MAX_WAIT_MS);
}

/**
 * Tokens de um prompt, por aproximação.
 *
 * Quatro caracteres por token é a regra de bolso da família GPT/Llama e erra para mais em
 * português, que é o lado seguro: superestimar gasta vaga à toa, subestimar estoura o limite real
 * da conta — que é exatamente o que este módulo existe para evitar.
 */
export function estimateGroqTokens(promptChars: number, maxOutputTokens: number): number {
  return Math.ceil(promptChars / 4) + maxOutputTokens;
}

/** Janela fixa de um minuto. Simples de raciocinar e barata: duas chaves com validade curta. */
function windowKeys(
  now: number,
  model: string,
): { requests: string; tokens: string; resetInMs: number } {
  const bucket = Math.floor(now / WINDOW_MS);
  return {
    requests: prefixRedisKey(`groq:rpm:${model}:${bucket}`),
    tokens: prefixRedisKey(`groq:tpm:${model}:${bucket}`),
    resetInMs: (bucket + 1) * WINDOW_MS - now,
  };
}

export type GroqLimiterDeps = {
  getClient?: typeof getRedisClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tenta consumir uma vaga na janela atual. Devolve quanto falta para a próxima janela quando não
 * há vaga — o chamador dorme esse tempo e tenta de novo.
 */
async function tryConsume(
  request: GroqSlotRequest,
  deps: Required<Pick<GroqLimiterDeps, 'getClient' | 'now'>>,
): Promise<{ ok: true } | { ok: false; retryInMs: number }> {
  const client = await deps.getClient();
  if (!client) return { ok: true };

  const { requests, tokens, resetInMs } = windowKeys(deps.now(), request.model);
  const requestLimit = getGroqRequestsPerMinute();
  const tokenLimit = getGroqTokensPerMinute();

  const usedRequests = await client.incr(requests);
  const usedTokens = await client.incrby(tokens, request.estimatedTokens);

  // A validade é maior que a janela para cobrir relógio fora de sincronia entre containers.
  await client.expire(requests, 120);
  await client.expire(tokens, 120);

  if (usedRequests <= requestLimit && usedTokens <= tokenLimit) {
    return { ok: true };
  }

  // Devolve o que foi reservado: quem não passou não pode contar contra a janela, senão dois
  // pedidos grandes se bloqueiam mutuamente para sempre.
  await client.decr(requests);
  await client.incrby(tokens, -request.estimatedTokens);

  return { ok: false, retryInMs: resetInMs + 50 };
}

/**
 * Espera até haver vaga na conta Groq. Lança `GroqRateLimitWaitTimeout` se o teto de espera
 * estourar — o chamador decide se devolve o job para a fila ou marca o documento.
 */
export async function acquireGroqSlot(
  request: GroqSlotRequest,
  deps: GroqLimiterDeps = {},
): Promise<{ waitedMs: number }> {
  const getClient = deps.getClient ?? getRedisClient;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const maxWaitMs = getGroqRateLimitMaxWaitMs();
  const startedAt = now();

  for (;;) {
    const attempt = await tryConsume(request, { getClient, now });
    if (attempt.ok) {
      const waitedMs = now() - startedAt;
      if (waitedMs > 0) {
        logger.info('groq_rate_limit_wait', {
          operation: request.operation,
          waitedMs,
          estimatedTokens: request.estimatedTokens,
        });
      }
      return { waitedMs };
    }

    const elapsed = now() - startedAt;
    if (elapsed + attempt.retryInMs > maxWaitMs) {
      throw new GroqRateLimitWaitTimeout(elapsed);
    }

    await sleep(attempt.retryInMs);
  }
}
