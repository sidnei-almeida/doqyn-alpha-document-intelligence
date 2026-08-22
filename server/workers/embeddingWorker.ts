import type { Job } from 'bullmq';
import {
  startEmbeddingWorker,
  type EmbeddingQueueJobPayload,
} from '../queues/embeddingQueue.js';
import { embedChunksMatching } from '../services/documentChunkEmbeddingService.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import { logger } from '../utils/logger.js';

export async function processEmbeddingJob(job: Job<EmbeddingQueueJobPayload>): Promise<void> {
  const { tenantId, documentId, versionId, userId, membershipId } = job.data;

  const collections = await getTenantCollections(tenantId, { userId, membershipId });
  const filter: Record<string, unknown> = {
    documentId,
    versionId,
    ...tenantScopeFilterFromContext(collections.storage),
  };

  const result = await embedChunksMatching(collections.documentChunks, filter);

  logger.info('embedding_job_done', {
    jobId: job.id,
    tenantId,
    documentId,
    versionId,
    ...result,
  });
}

export async function runEmbeddingWorkerLoop(): Promise<void> {
  const worker = startEmbeddingWorker(processEmbeddingJob);
  if (!worker) {
    // Não é erro: com EMBEDDING_ENABLED=false o resto do worker continua útil.
    logger.info('Embedding worker desligado (EMBEDDING_ENABLED/REDIS_URL)');
    return;
  }

  worker.on('failed', (job, error) => {
    logger.warn('embedding worker failed event', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('Embedding worker aguardando jobs');
}
