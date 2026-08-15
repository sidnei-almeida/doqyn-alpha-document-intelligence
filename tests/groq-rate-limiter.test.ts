import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  acquireGroqSlot,
  estimateGroqTokens,
  GroqRateLimitWaitTimeout,
} from '../server/ai/services/groqRateLimiter.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

/** Redis de mentira com só o que o limitador usa: incr, incrby, expire. */
function fakeRedis() {
  const store = new Map<string, number>();

  const client = {
    async incr(key: string) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async incrby(key: string, amount: number) {
      const next = (store.get(key) ?? 0) + amount;
      store.set(key, next);
      return next;
    },
    async decr(key: string) {
      const next = (store.get(key) ?? 0) - 1;
      store.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
  };

  return { store, getClient: async () => client as never };
}

/** Relógio controlado: o limitador dorme até a próxima janela, e o teste não pode dormir junto. */
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('vazão da Groq', () => {
  it('estima tokens somando prompt e saída, arredondando para cima', () => {
    assert.equal(estimateGroqTokens(4000, 1200), 2200);
    assert.equal(estimateGroqTokens(1, 0), 1);
  });

  it('deixa passar enquanto cabe na janela', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '3';
    process.env.GROQ_MAX_TOKENS_PER_MINUTE = '100000';
    const redis = fakeRedis();
    const clock = fakeClock();

    for (let i = 0; i < 3; i += 1) {
      const result = await acquireGroqSlot(
        { estimatedTokens: 100, operation: 'teste' },
        { getClient: redis.getClient, now: clock.now, sleep: clock.sleep },
      );
      assert.equal(result.waitedMs, 0);
    }
  });

  it('segura o pedido excedente até a próxima janela em vez de deixar tomar 429', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '1';
    process.env.GROQ_MAX_TOKENS_PER_MINUTE = '100000';
    const redis = fakeRedis();
    const clock = fakeClock();
    const deps = { getClient: redis.getClient, now: clock.now, sleep: clock.sleep };

    await acquireGroqSlot({ estimatedTokens: 10, operation: 'primeiro' }, deps);
    const segundo = await acquireGroqSlot({ estimatedTokens: 10, operation: 'segundo' }, deps);

    assert.ok(segundo.waitedMs > 0, 'o segundo pedido deveria ter esperado a janela virar');
    assert.ok(segundo.waitedMs <= 60_050, `esperou demais: ${segundo.waitedMs}ms`);
  });

  it('limita por tokens, não só por número de pedidos', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '1000';
    process.env.GROQ_MAX_TOKENS_PER_MINUTE = '5000';
    const redis = fakeRedis();
    const clock = fakeClock();
    const deps = { getClient: redis.getClient, now: clock.now, sleep: clock.sleep };

    await acquireGroqSlot({ estimatedTokens: 4000, operation: 'grande' }, deps);
    const segundo = await acquireGroqSlot({ estimatedTokens: 4000, operation: 'grande' }, deps);

    assert.ok(segundo.waitedMs > 0, 'o segundo estouraria o teto de tokens da janela');
  });

  it('devolve a reserva de quem não passou — senão dois pedidos grandes se bloqueiam para sempre', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '1';
    process.env.GROQ_MAX_TOKENS_PER_MINUTE = '100000';
    const redis = fakeRedis();
    const clock = fakeClock();
    const deps = { getClient: redis.getClient, now: clock.now, sleep: clock.sleep };

    await acquireGroqSlot({ estimatedTokens: 10, operation: 'primeiro' }, deps);
    await acquireGroqSlot({ estimatedTokens: 10, operation: 'segundo' }, deps);

    const contadores = [...redis.store.entries()].filter(([key]) => key.includes('groq:rpm'));
    for (const [, valor] of contadores) {
      assert.ok(valor <= 1, `contador ficou acima do limite: ${valor}`);
    }
  });

  it('desiste depois do teto de espera, em vez de segurar o worker indefinidamente', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '1';
    process.env.GROQ_MAX_TOKENS_PER_MINUTE = '100000';
    process.env.GROQ_RATE_LIMIT_MAX_WAIT_MS = '1000';
    const redis = fakeRedis();
    const clock = fakeClock();
    const deps = { getClient: redis.getClient, now: clock.now, sleep: clock.sleep };

    await acquireGroqSlot({ estimatedTokens: 10, operation: 'primeiro' }, deps);

    await assert.rejects(
      acquireGroqSlot({ estimatedTokens: 10, operation: 'segundo' }, deps),
      (error: unknown) => error instanceof GroqRateLimitWaitTimeout,
    );
  });

  it('sem Redis não limita nada — mesmo critério do resto do sistema em desenvolvimento', async () => {
    process.env.GROQ_MAX_REQUESTS_PER_MINUTE = '1';
    const clock = fakeClock();
    const deps = { getClient: async () => null, now: clock.now, sleep: clock.sleep };

    for (let i = 0; i < 5; i += 1) {
      const result = await acquireGroqSlot({ estimatedTokens: 10, operation: 'teste' }, deps);
      assert.equal(result.waitedMs, 0);
    }
  });
});
