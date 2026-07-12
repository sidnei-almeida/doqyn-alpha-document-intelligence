import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.6 — MongoDB Atlas', () => {
  it('mongoConfig detecta Atlas por flag ou URI SRV', () => {
    const source = read('server/db/mongoConfig.ts');
    assert.ok(source.includes('MONGODB_USE_ATLAS'));
    assert.ok(source.includes('mongodb+srv://'));
    assert.ok(source.includes('MONGODB_SERVER_SELECTION_TIMEOUT_MS'));
  });

  it('container mongo usa profile local-mongo no compose de produção', () => {
    const compose = read('deploy/docker-compose.production.yml');
    assert.ok(compose.includes('profiles: ["local-mongo"]'));
    assert.ok(compose.includes('mongo:'));
  });

  it('compose-production.sh omite profile quando MONGODB_USE_ATLAS=true', () => {
    const lib = read('deploy/scripts/lib/compose-production.sh');
    assert.ok(lib.includes('MONGODB_USE_ATLAS'));
    assert.ok(lib.includes('--profile local-mongo'));
    assert.ok(lib.includes('is_mongodb_atlas_deploy'));
  });

  it('deploy-production não sobe mongo quando Atlas está ativo', () => {
    const deploy = read('deploy/scripts/deploy-production.sh');
    assert.ok(deploy.includes('is_mongodb_atlas_deploy'));
    assert.ok(deploy.includes('sem container mongo local'));
  });

  it('setup-production-env gera MONGODB_USE_ATLAS', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.ok(setup.includes('MONGODB_USE_ATLAS=true'));
    assert.ok(setup.includes('MONGODB_USE_ATLAS=false'));
  });

  it('script sync-mongodb-indexes.sh existe', () => {
    const sync = read('deploy/scripts/sync-mongodb-indexes.sh');
    assert.ok(sync.includes('doqyn-api-indexes'));
  });
});
