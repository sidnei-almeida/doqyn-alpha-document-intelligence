import type { Job } from 'bullmq';
import type { MongoDocumentVersion } from '../db/types.js';
import { getStorageProvider } from '../storage/index.js';
import { R2StorageProvider } from '../storage/r2/r2StorageProvider.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { logger } from '../utils/logger.js';
import { onShutdown } from '../runtime/shutdown.js';
import {
  enqueueStagingCleanupJob,
  startStoragePromotionWorker,
  STORAGE_PROMOTION_JOB_NAMES,
  type StoragePromotionJobPayload,
} from '../queues/storagePromotionQueue.js';

function getR2Provider(): R2StorageProvider | null {
  const provider = getStorageProvider();
  return provider instanceof R2StorageProvider ? provider : null;
}

/**
 * Copia o provisório para a chave definitiva e troca o endereço da versão.
 *
 * A troca no Mongo é condicional ao endereço ainda ser o provisório. É isso que torna a repetição
 * segura: uma segunda tentativa encontra a chave definitiva já gravada e para, e uma versão apagada ou
 * substituída no meio do caminho não recebe um endereço que ninguém pediu.
 */
export async function promoteStagedVersionFile(
  payload: StoragePromotionJobPayload,
): Promise<'promoted' | 'skipped'> {
  const provider = getR2Provider();
  if (!provider) {
    logger.warn('promoção de storage ignorada: provedor não é R2', {
      versionId: payload.versionId,
    });
    return 'skipped';
  }

  const { documentVersions } = await getTenantCollections(payload.tenantId, {
    userId: payload.ownerUserId,
  });
  const version = (await documentVersions.findOne({
    _id: payload.versionId,
    documentId: payload.documentId,
  } as Record<string, unknown>)) as MongoDocumentVersion | null;

  if (!version || version.storage?.primary?.objectKey !== payload.stagingKey) {
    return 'skipped';
  }

  await provider.copyObjectWithinBucket({
    bucket: payload.bucket,
    sourceKey: payload.stagingKey,
    destinationKey: payload.destinationKey,
    contentType: payload.contentType,
  });

  const result = await documentVersions.updateOne(
    {
      _id: payload.versionId,
      documentId: payload.documentId,
      'storage.primary.objectKey': payload.stagingKey,
    } as Record<string, unknown>,
    {
      $set: {
        'storage.primary.objectKey': payload.destinationKey,
        'storage.primary.bucketAlias': payload.bucket,
        'storage.primary.storedAt': new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    // A versão mudou entre a leitura e a troca: a cópia ficou sem dono.
    await provider
      .deleteDocumentVersion(payload.destinationKey, payload.tenantId, payload.bucket)
      .catch(() => undefined);
    return 'skipped';
  }

  await enqueueStagingCleanupJob(payload).catch((error: unknown) => {
    logger.warn('limpeza do provisório não agendada', {
      versionId: payload.versionId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  });

  return 'promoted';
}

/**
 * Apaga o provisório depois da janela de segurança — e só se nenhuma versão ainda apontar para ele.
 *
 * A checagem não é zelo: se a promoção de uma versão falhou de vez, ela continua servida pelo
 * provisório, e apagar aqui tiraria o arquivo de um documento vivo.
 */
export async function cleanupPromotedStaging(payload: StoragePromotionJobPayload): Promise<void> {
  const provider = getR2Provider();
  if (!provider) return;

  const { documentVersions } = await getTenantCollections(payload.tenantId, {
    userId: payload.ownerUserId,
  });
  const stillReferenced = await documentVersions.countDocuments({
    'storage.primary.objectKey': payload.stagingKey,
  } as Record<string, unknown>);
  if (stillReferenced > 0) return;

  await provider.deleteDocumentVersion(payload.stagingKey, payload.tenantId, payload.bucket);
}

async function processStoragePromotionJob(job: Job<StoragePromotionJobPayload>): Promise<void> {
  const payload = job.data;
  const startedAt = Date.now();

  if (job.name === STORAGE_PROMOTION_JOB_NAMES.cleanup) {
    await cleanupPromotedStaging(payload);
    return;
  }

  const outcome = await promoteStagedVersionFile(payload);
  logger.info('storage promotion job completed', {
    requestId: payload.requestId,
    documentId: payload.documentId,
    versionId: payload.versionId,
    outcome,
    durationMs: Date.now() - startedAt,
  });
}

export async function runStoragePromotionWorkerLoop(): Promise<void> {
  const worker = startStoragePromotionWorker(processStoragePromotionJob);
  if (!worker) {
    // Não é erro: sem Redis a confirmação copia dentro do request, como antes.
    logger.info('Storage promotion worker desligado (REDIS_URL/REDIS_ENABLED)');
    return;
  }

  worker.on('failed', (job, error) => {
    logger.warn('storage promotion job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  });

  // No SIGTERM o worker para de pegar job novo e espera o que está em mãos terminar, em vez
  // de ser morto no meio e deixar a vaga do tenant presa até o prazo vencer.
  onShutdown('worker de promoção de arquivo', () => worker.close());

  logger.info('Storage promotion worker aguardando jobs');
}
