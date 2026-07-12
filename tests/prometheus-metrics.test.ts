import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeApiRouteLabel } from '../server/metrics/apiRouteLabel.js';

describe('Prometheus — labels de rota', () => {
  it('normaliza IDs dinâmicos sem explodir cardinalidade', () => {
    assert.equal(normalizeApiRouteLabel('/api/health'), '/api/health');
    assert.equal(
      normalizeApiRouteLabel('/api/ai/jobs/job_abc123xyz'),
      '/api/ai/jobs/:jobId',
    );
    assert.equal(
      normalizeApiRouteLabel('/api/documents/507f1f77bcf86cd799439011'),
      '/api/documents/:documentId',
    );
  });
});

describe('Prometheus — métricas', () => {
  it('renderiza métricas com prom-client quando habilitado', async () => {
    const originalEnabled = process.env.METRICS_ENABLED;
    process.env.METRICS_ENABLED = 'true';

    try {
      const { initPrometheusMetrics, recordHttpRequest, renderPrometheusMetrics } =
        await import('../server/metrics/prometheus.js');

      initPrometheusMetrics();
      recordHttpRequest({
        method: 'GET',
        route: '/api/health',
        statusCode: 200,
        durationSeconds: 0.01,
      });

      const body = await renderPrometheusMetrics();
      assert.match(body, /doqyn_http_requests_total/);
      assert.match(body, /doqyn_process_cpu/);
    } finally {
      if (originalEnabled === undefined) delete process.env.METRICS_ENABLED;
      else process.env.METRICS_ENABLED = originalEnabled;
    }
  });

  it('endpoint /api/metrics importa handler', async () => {
    const mod = await import('../api/metrics.js');
    assert.equal(typeof mod.default, 'function');
  });
});
