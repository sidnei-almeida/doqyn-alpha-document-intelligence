import type { Job } from 'bullmq';
import {
  generateDocumentPreviewForVersion,
} from '../services/documentPreviewService.js';
import type { PreviewQueueJobPayload } from '../services/preview/previewJobTypes.js';
import {
  applyDocumentPreviewResult,
  loadDocumentVersionForPreview,
  markDocumentPreviewProcessing,
} from '../services/preview/previewJobPersistence.js';
import { startPreviewWorker } from '../queues/previewQueue.js';
import { resolveTenantStorageScopeById } from '../tenancy/resolveTenantStorageScope.js';
import { logger } from '../utils/logger.js';
import { recordPreviewJobCompletion } from '../metrics/prometheus.js';

async function processPreviewJob(job: Job<PreviewQueueJobPayload>): Promise<void> {
  const payload = job.data;
  const startedAt = Date.now();

  await markDocumentPreviewProcessing(payload);

  const version = await loadDocumentVersionForPreview(payload);
  if (!version) {
    throw new Error(`Versão não encontrada: ${payload.versionId}`);
  }

  const primary = version.storage?.primary;
  if (!primary?.objectKey || primary.status !== 'stored') {
    throw new Error('Original da versão ainda não está armazenado.');
  }

  const storageScope = await resolveTenantStorageScopeById(payload.tenantId);
  const previewStorageFileName =
    payload.previewStorageFileName.trim() ||
    version.previewStorageFileName?.trim() ||
    `${version.finalFileName?.replace(/\.pdf$/i, '') ?? 'document'}_preview.pdf`;

  const result = await generateDocumentPreviewForVersion({
    tenantId: payload.tenantId,
    documentId: payload.documentId,
    versionId: payload.versionId,
    contentType: payload.contentType,
    storageScope,
    primary,
    previewStorageFileName,
  });

  await applyDocumentPreviewResult({
    tenantId: payload.tenantId,
    ownerUserId: payload.ownerUserId,
    documentId: payload.documentId,
    versionId: payload.versionId,
    slot: result.slot,
    previewManifest: result.previewManifest,
  });

  const status =
    result.slot.status === 'ready'
      ? 'ready'
      : result.slot.status === 'skipped'
        ? 'skipped'
        : 'failed';

  recordPreviewJobCompletion({
    status,
    durationSeconds: (Date.now() - startedAt) / 1000,
  });

  logger.info('preview worker job completed', {
    jobId: payload.jobId,
    tenantId: payload.tenantId,
    documentId: payload.documentId,
    versionId: payload.versionId,
    previewStatus: result.slot.status,
  });
}

export async function runPreviewWorkerLoop(): Promise<void> {
  const worker = startPreviewWorker(processPreviewJob);
  if (!worker) {
    throw new Error(
      'Fila de preview indisponível — configure REDIS_URL e PREVIEW_SYNC_FALLBACK=false',
    );
  }

  worker.on('failed', (job, error) => {
    logger.warn('preview worker failed event', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('Preview worker aguardando jobs');
}
