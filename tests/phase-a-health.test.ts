import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveOverallStatus,
  type DeepHealthReport,
} from '../server/health/deepHealthCheck.js';

function makeChecks(
  overrides: Partial<DeepHealthReport['checks']> = {},
): DeepHealthReport['checks'] {
  return {
    mongo: { ok: true },
    redis: { ok: true },
    r2: { ok: true, configured: true },
    auth: { ok: true },
    analysisQueue: { ok: true, waiting: 0, active: 0 },
    previewQueue: { ok: true, waiting: 0, active: 0 },
    aiProvider: { ok: true, name: 'groq', configured: true },
    visionOcr: { ok: true, enabled: false, configured: false, name: 'google_vision' },
    ...overrides,
  };
}

describe('Fase A — deep health status', () => {
  it('mongo down retorna down', () => {
    assert.equal(resolveOverallStatus(makeChecks({ mongo: { ok: false } })), 'down');
  });

  it('redis down retorna degraded', () => {
    const originalRedisUrl = process.env.REDIS_URL;
    const originalRedisEnabled = process.env.REDIS_ENABLED;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.REDIS_ENABLED = 'true';

    try {
      assert.equal(
        resolveOverallStatus(makeChecks({ redis: { ok: false, message: 'ping failed' } })),
        'degraded',
      );
    } finally {
      if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = originalRedisUrl;
      if (originalRedisEnabled === undefined) delete process.env.REDIS_ENABLED;
      else process.env.REDIS_ENABLED = originalRedisEnabled;
    }
  });

  it('em produção, fila ou IA down degradam o status', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalFallback = process.env.ANALYSIS_SYNC_FALLBACK;
    const originalRedisUrl = process.env.REDIS_URL;
    const originalRedisEnabled = process.env.REDIS_ENABLED;

    process.env.NODE_ENV = 'production';
    process.env.ANALYSIS_SYNC_FALLBACK = 'false';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.REDIS_ENABLED = 'true';

    try {
      assert.equal(
        resolveOverallStatus(makeChecks({ analysisQueue: { ok: false, message: 'disabled' } })),
        'degraded',
      );
      assert.equal(
        resolveOverallStatus(makeChecks({ aiProvider: { ok: false, name: 'groq', configured: false } })),
        'degraded',
      );
      assert.equal(
        resolveOverallStatus(makeChecks({ r2: { ok: false, configured: false, message: 'missing' } })),
        'degraded',
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalFallback === undefined) delete process.env.ANALYSIS_SYNC_FALLBACK;
      else process.env.ANALYSIS_SYNC_FALLBACK = originalFallback;
      if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = originalRedisUrl;
      if (originalRedisEnabled === undefined) delete process.env.REDIS_ENABLED;
      else process.env.REDIS_ENABLED = originalRedisEnabled;
    }
  });
});
