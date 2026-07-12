import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { buildPendingPreviewSlot } from '../server/services/documentPreviewService.js';
import {
  isPreviewQueueEnabled,
  isPreviewSyncFallbackEnabled,
} from '../server/queues/previewQueue.js';

describe('Fase B.2 — fila de preview', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('preview sync fallback ativo em dev por padrão', () => {
    delete process.env.PREVIEW_SYNC_FALLBACK;
    process.env.NODE_ENV = 'development';
    assert.equal(isPreviewSyncFallbackEnabled(), true);
    assert.equal(isPreviewQueueEnabled(), false);
  });

  it('preview queue habilitada com Redis e PREVIEW_SYNC_FALLBACK=false', () => {
    process.env.REDIS_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.PREVIEW_SYNC_FALLBACK = 'false';
    process.env.NODE_ENV = 'production';
    assert.equal(isPreviewQueueEnabled(), true);
  });

  it('buildPendingPreviewSlot marca versão como pending', () => {
    const slot = buildPendingPreviewSlot(
      {
        provider: 'cloudflare_r2',
        status: 'stored',
        objectKey: 'tenants/acme/doc.pdf',
        bucketAlias: 'tenant-acme',
        storedAt: new Date(),
      },
      'ver_123',
    );

    assert.equal(slot.status, 'pending');
    assert.equal(slot.sourceVersionId, 'ver_123');
    assert.equal(slot.objectKey, null);
  });

  it('módulos do worker de preview importam', async () => {
    const scheduling = await import('../server/services/preview/documentPreviewScheduling.js');
    assert.equal(typeof scheduling.scheduleDocumentPreviewForVersion, 'function');
    assert.equal(typeof scheduling.enqueueScheduledDocumentPreview, 'function');

    const worker = await import('../server/workers/previewWorker.js');
    assert.equal(typeof worker.runPreviewWorkerLoop, 'function');
  });
});
