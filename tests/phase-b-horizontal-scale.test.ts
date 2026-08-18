import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.4 — réplicas API e auth', () => {
  it('nginx usa DNS Docker + least_conn para múltiplas réplicas', () => {
    const nginx = read('deploy/nginx/default.conf.template');
    assert.ok(nginx.includes('resolver 127.0.0.11'));
    assert.ok(nginx.includes('least_conn'));
    assert.ok(nginx.includes('server doqyn-api:3001 resolve'));
    assert.ok(nginx.includes('server auth-api:4100 resolve'));
    assert.ok(nginx.includes('zone doqyn_api'));
    assert.ok(nginx.includes('keepalive 32'));
  });

  it('deploy-production escala auth-api e doqyn-api', () => {
    const deploy = read('deploy/scripts/deploy-production.sh');
    assert.ok(deploy.includes('AUTH_API_REPLICAS'));
    assert.ok(deploy.includes('DOQYN_API_REPLICAS'));
    assert.ok(deploy.includes('--scale "auth-api=${AUTH_API_REPLICAS}"'));
    assert.ok(deploy.includes('--scale "doqyn-api=${DOQYN_API_REPLICAS}"'));
  });

  it('prometheus descobre todas as réplicas da API via DNS', () => {
    const prom = read('deploy/observability/prometheus.yml');
    assert.ok(prom.includes('dns_sd_configs'));
    assert.ok(prom.includes("names: ['doqyn-api']"));
  });

  it('script scale-api-replicas.sh existe', () => {
    const scale = read('deploy/scripts/scale-api-replicas.sh');
    assert.ok(scale.includes('compose up -d --no-recreate --scale'));
  });
});
