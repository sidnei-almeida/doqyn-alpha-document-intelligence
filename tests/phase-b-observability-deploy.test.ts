import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Observabilidade em produção', () => {
  it('compose tem profile observability com prometheus e grafana', () => {
    const compose = read('deploy/docker-compose.production.yml');
    assert.ok(compose.includes('profiles: ["observability"]'));
    assert.ok(compose.includes('prom/prometheus'));
    assert.ok(compose.includes('grafana/grafana'));
    assert.ok(compose.includes('prometheus_data:'));
    assert.ok(compose.includes('doqyn-worker-preview:9100') || compose.includes('doqyn-worker-preview'));
  });

  it('prometheus scrape api, workers e redis', () => {
    const prom = read('deploy/observability/prometheus.yml');
    assert.ok(prom.includes('doqyn-api'));
    assert.ok(prom.includes('doqyn-worker'));
    assert.ok(prom.includes('doqyn-worker-preview'));
    assert.ok(prom.includes('redis-exporter'));
    assert.ok(prom.includes('dns_sd_configs'));
  });

  it('scripts up/down observability usam compose_production_observability', () => {
    const up = read('deploy/scripts/up-observability.sh');
    const down = read('deploy/scripts/down-observability.sh');
    assert.ok(up.includes('compose_production_observability'));
    assert.ok(down.includes('compose_production_observability'));
  });

  it('setup produção habilita observabilidade por padrão', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.ok(setup.includes('OBSERVABILITY_ENABLE=true'));
    assert.ok(setup.includes('sync-observability-secrets.sh'));
  });

  it('deploy sobe observabilidade quando flag ativa', () => {
    const deploy = read('deploy/scripts/deploy-production.sh');
    assert.ok(deploy.includes('OBSERVABILITY_ENABLE'));
    assert.ok(deploy.includes('up-observability.sh'));
  });

  it('métricas atualizam filas no scrape da API', () => {
    const prom = read('server/metrics/prometheus.ts');
    assert.ok(prom.includes('refreshQueueDepthGauges'));
    assert.ok(prom.includes('getAnalysisQueueStats'));
    assert.ok(prom.includes('getPreviewQueueStats'));
  });

  it('alertas cobrem filas, 5xx, sessão e Groq', () => {
    const alerts = read('deploy/observability/alerts/doqyn-alerts.yml');
    assert.ok(alerts.includes('DoqynAnalysisQueueBacklog'));
    assert.ok(alerts.includes('DoqynPreviewQueueBacklog'));
    assert.ok(alerts.includes('DoqynApiHighErrorRate'));
    assert.ok(alerts.includes('DoqynSessionCacheLowHitRate'));
    assert.ok(alerts.includes('DoqynAiProviderErrors'));
  });

  it('script prepare-ubuntu-host existe para Ubuntu/Hostinger', () => {
    const prep = read('deploy/scripts/prepare-ubuntu-host.sh');
    assert.ok(prep.includes('systemctl mask'));
    assert.ok(prep.includes('sites-enabled/default'));
    assert.ok(prep.includes('--purge'));
  });
});
