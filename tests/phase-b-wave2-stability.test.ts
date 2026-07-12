import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Onda 2 — estabilidade', () => {
  it('quotas fail-open sem Redis e default OFF', () => {
    const source = read('server/tenancy/tenantQuotas.ts');
    assert.ok(source.includes('Fail-open') || source.includes('fail-open') || source.includes('return;'));
    assert.ok(source.includes("if (!raw) return false"));
    assert.equal(source.includes('QUOTA_SERVICE_UNAVAILABLE'), false);
  });

  it('auth-service.env.example alinhado (sem SESSION_SECRET=)', () => {
    const env = read('deploy/env/auth-service.env.example');
    assert.equal(/^SESSION_SECRET=/m.test(env), false);
    assert.ok(env.includes('DOQYN_APP_INTERNAL_API_KEY'));
    assert.ok(env.includes('DOQYN_INTERNAL_API_KEY'));
    assert.ok(env.includes('DATA_ENCRYPTION_KEY'));
    assert.ok(env.includes('SESSION_TOKEN_HASH_SECRET'));
  });

  it('redis client tipa Redis via named import', () => {
    const source = read('server/redis/redisClient.ts');
    assert.ok(source.includes("import { Redis } from 'ioredis'"));
  });

  it('enqueuePdfAnalysisJob importa AnalysisEnqueueResponse de analysisJobTypes', () => {
    const source = read('server/services/analysis/enqueuePdfAnalysisJob.ts');
    assert.ok(source.includes("from './analysisJobTypes.js'"));
    assert.ok(source.includes('AnalysisEnqueueResponse'));
  });
});
