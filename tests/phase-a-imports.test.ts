import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Fase A — imports dos módulos novos', () => {
  it('api/ai/jobs/[jobId] importa dependências do servidor', async () => {
    const mod = await import('../api/ai/jobs/[jobId].js');
    assert.equal(typeof mod.default, 'function');
  });

  it('analysisJobTypes importa AnalyzePdfResponse', async () => {
    const mod = await import('../server/services/analysis/analysisJobTypes.js');
    assert.ok(mod);
  });

  it('deep health handler importa runDeepHealthCheck', async () => {
    const mod = await import('../api/health/deep.js');
    assert.equal(typeof mod.default, 'function');
  });

  it('analysisTenantConcurrency importa redis helpers', async () => {
    const mod = await import('../server/queues/analysisTenantConcurrency.js');
    assert.equal(typeof mod.tryAcquireTenantAnalysisSlot, 'function');
    assert.equal(typeof mod.releaseTenantAnalysisSlot, 'function');
  });

  it('analysisWorker importa processador da fila', async () => {
    const mod = await import('../server/workers/analysisWorker.js');
    assert.equal(typeof mod.startInProcessAnalysisWorker, 'function');
    assert.equal(typeof mod.runAnalysisWorkerLoop, 'function');
  });

  it('enqueuePdfAnalysisJob exporta helper de fila', async () => {
    const mod = await import('../server/services/analysis/enqueuePdfAnalysisJob.js');
    assert.equal(typeof mod.enqueuePdfAnalysisJob, 'function');
    assert.equal(typeof mod.isAsyncPdfAnalysisAvailable, 'function');
  });
});
