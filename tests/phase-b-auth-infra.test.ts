import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.3 — PgBouncer + rate limit Redis (auth)', () => {
  it('compose de produção inclui pgbouncer e auth-api via pool', () => {
    const compose = read('deploy/docker-compose.production.yml');
    assert.ok(compose.includes('pgbouncer:'));
    assert.ok(compose.includes('edoburu/pgbouncer'));
    assert.ok(compose.includes('@pgbouncer:5432'));
    assert.ok(compose.includes('DATABASE_URL_DIRECT'));
    assert.ok(compose.includes('RATE_LIMIT_REDIS_ENABLED'));
  });

  it('setup de produção gera DATABASE_URL via pgbouncer', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.ok(setup.includes('DATABASE_URL_DIRECT'));
    assert.ok(setup.includes('@pgbouncer:5432'));
    assert.ok(setup.includes('RATE_LIMIT_REDIS_ENABLED'));
  });

  it('auth-service usa rate limit Redis com fallback in-memory', () => {
    const rateLimit = read('../doqyn-auth-service/src/security/rateLimit.ts');
    assert.ok(rateLimit.includes('redisIncrWithTtl'));
    assert.ok(rateLimit.includes('checkLimitMemory'));
    assert.match(rateLimit, /export async function checkLoginRateLimit/);
  });
});
