import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  estimateGroqTokens,
  getGroqExpectedOutputTokens,
  reconcileGroqUsage,
} from '../server/ai/services/groqRateLimiter.js';
import { parseGroqLimitHeaders } from '../server/ai/services/groqLimitCalibration.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function fakeRedis() {
  const store = new Map<string, number>();
  const client = {
    async incrby(key: string, amount: number) {
      const next = (store.get(key) ?? 0) + amount;
      store.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
  };
  return { store, getClient: async () => client as never };
}

describe('contagem de tokens da janela Groq', () => {
  it('reserva a saída esperada, não o teto de max_tokens', () => {
    // 600 caracteres de prompt ≈ 150 tokens. Com a reserva antiga (o teto de 1.200) três
    // documentos enchiam uma janela de 6.000 e o quarto esperava a virada do minuto.
    assert.equal(estimateGroqTokens(600), 150 + getGroqExpectedOutputTokens());
    assert.equal(getGroqExpectedOutputTokens(), 400);
  });

  it('a reserva é configurável', () => {
    process.env.GROQ_EXPECTED_OUTPUT_TOKENS = '250';
    assert.equal(getGroqExpectedOutputTokens(), 250);
    assert.equal(estimateGroqTokens(400, 100), 200);
  });

  it('devolve à janela o que foi reservado a mais', async () => {
    const redis = fakeRedis();

    await reconcileGroqUsage(
      { model: 'llama-3.3-70b-versatile', estimatedTokens: 550, actualTokens: 320 },
      { getClient: redis.getClient, now: () => 60_000 },
    );

    const [[, value]] = [...redis.store.entries()];
    assert.equal(value, -230);
  });

  it('cobra a diferença quando a resposta gastou mais que o previsto', async () => {
    const redis = fakeRedis();

    await reconcileGroqUsage(
      { model: 'llama-3.1-8b-instant', estimatedTokens: 500, actualTokens: 900 },
      { getClient: redis.getClient, now: () => 60_000 },
    );

    const [[, value]] = [...redis.store.entries()];
    assert.equal(value, 400);
  });

  it('não toca no Redis quando a estimativa bateu', async () => {
    const redis = fakeRedis();

    await reconcileGroqUsage(
      { model: 'm', estimatedTokens: 500, actualTokens: 500 },
      { getClient: redis.getClient, now: () => 0 },
    );

    assert.equal(redis.store.size, 0);
  });
});

describe('calibração pelos cabeçalhos da Groq', () => {
  it('lê os limites por minuto da resposta', () => {
    const headers = new Headers({
      'x-ratelimit-limit-requests': '30',
      'x-ratelimit-limit-tokens': '12000',
    });

    assert.deepEqual(parseGroqLimitHeaders(headers), {
      requestsPerMinute: 30,
      tokensPerMinute: 12_000,
    });
  });

  it('ignora cabeçalho ausente ou sem número utilizável', () => {
    assert.equal(parseGroqLimitHeaders(new Headers()), null);
    assert.equal(parseGroqLimitHeaders(undefined), null);
    assert.equal(
      parseGroqLimitHeaders(new Headers({ 'x-ratelimit-limit-tokens': 'sei-lá' })),
      null,
    );
    assert.equal(parseGroqLimitHeaders(new Headers({ 'x-ratelimit-limit-tokens': '0' })), null);
  });
});
