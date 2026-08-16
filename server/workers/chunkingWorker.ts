import type { Job } from 'bullmq';
import {
  startChunkingWorker,
  type ChunkingQueueJobPayload,
} from '../queues/chunkingQueue.js';
import { persistChunksAfterVersionConfirm } from '../services/confirmVersionChunkPersistence.js';
import { getStorageProvider } from '../storage/index.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { resolveTenantStorageScopeById } from '../tenancy/resolveTenantStorageScope.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { recordChunkingJobCompletion } from '../metrics/prometheus.js';
import { logger } from '../utils/logger.js';

export async function processChunkingJob(job: Job<ChunkingQueueJobPayload>): Promise<void> {
  const payload = job.data;
  const startedAt = Date.now();

  // `createdBy` como reserva: em tenant PF o escopo depende do dono, e um payload antigo sem
  // `userId` encontraria zero versões em vez de falhar alto.
  const collections = await getTenantCollections(payload.tenantId, {
    userId: payload.userId ?? payload.createdBy,
    membershipId: payload.membershipId,
  });

  const version = await collections.documentVersions.findOne({
    _id: payload.versionId,
    documentId: payload.documentId,
    ...tenantScopeFilterFromContext(collections.storage),
  });

  if (!version) {
    throw new Error(`Versão não encontrada: ${payload.versionId}`);
  }

  const primary = version.storage?.primary;
  if (!primary?.objectKey || primary.status !== 'stored') {
    throw new Error('Original da versão ainda não está armazenado.');
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new Error('Storage não configurado para o fatiamento.');
  }

  const storageScope = await resolveTenantStorageScopeById(payload.tenantId);
  const original = await provider.readDocumentVersion(
    primary.objectKey,
    payload.tenantId,
    primary.bucketAlias,
    storageScope,
  );

  // O contexto é montado aqui porque o worker não nasce de um request. O que importa para o
  // fatiamento é o par `collections` + `storage`: é dele que sai o escopo de tenant gravado em
  // cada trecho.
  const ctx: DocumentRequestContext = {
    tenantId: payload.tenantId,
    userId: payload.userId ?? payload.createdBy,
    membershipId: payload.membershipId,
    storage: collections.storage,
    storageScope,
    collections,
  };

  await persistChunksAfterVersionConfirm({
    ctx,
    pdfBuffer: original.buffer,
    documentId: payload.documentId,
    versionId: payload.versionId,
    versionLabel: payload.versionLabel,
    categoryId: payload.categoryId,
    createdBy: payload.createdBy,
    isCurrentVersion: payload.isCurrentVersion,
    mimeType: payload.mimeType ?? version.file?.mimeType,
  });

  const durationSeconds = (Date.now() - startedAt) / 1000;
  recordChunkingJobCompletion({ status: 'completed', durationSeconds });

  logger.info('chunking_job_done', {
    jobId: job.id,
    tenantId: payload.tenantId,
    documentId: payload.documentId,
    versionId: payload.versionId,
    durationMs: Date.now() - startedAt,
  });
}

export async function runChunkingWorkerLoop(): Promise<void> {
  const worker = startChunkingWorker(processChunkingJob);
  if (!worker) {
    // Não é erro: sem Redis o fatiamento volta a acontecer no request da confirmação.
    logger.info('Chunking worker desligado (REDIS_URL/REDIS_ENABLED)');
    return;
  }

  worker.on('failed', (job, error) => {
    recordChunkingJobCompletion({ status: 'failed', durationSeconds: 0 });
    logger.warn('chunking worker failed event', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('Chunking worker aguardando jobs');
}
