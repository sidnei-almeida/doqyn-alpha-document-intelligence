import { DelayedError, type Job } from 'bullmq';
import { analyzePdfBuffer } from '../ai/services/analyzePdfService.js';
import { analyzePdfUpdateBuffer } from '../ai/services/analyzePdfUpdateService.js';
import { resolveAnalysisProviderName } from '../ai/providers/resolveAnalysisProvider.js';
import { loadAnalysisStaging, isStorageConfigured } from '../storage/index.js';
import { resolveTenantStorageScopeById } from '../tenancy/resolveTenantStorageScope.js';
import {
  completeAnalysisJob,
  failAnalysisJob,
  loadAnalysisJobPayload,
  markAnalysisJobProcessing,
} from '../services/analysis/analysisJobService.js';
import type { AnalysisQueueJobPayload } from '../services/analysis/analysisJobTypes.js';
import { startAnalysisWorker } from '../queues/analysisQueue.js';
import {
  releaseTenantAnalysisSlot,
  tryAcquireTenantAnalysisSlot,
} from '../queues/analysisTenantConcurrency.js';
import { logger } from '../utils/logger.js';

const TENANT_SLOT_RETRY_DELAY_MS = 5_000;

let workerStarted = false;

async function loadJobBuffer(payload: AnalysisQueueJobPayload): Promise<Buffer> {
  if (!isStorageConfigured()) {
    throw new Error('Storage não configurado para processamento assíncrono.');
  }

  const storageScope = await resolveTenantStorageScopeById(payload.tenantId);
  return loadAnalysisStaging({
    tenantId: payload.tenantId,
    ownerUserId: payload.ownerUserId,
    jobId: payload.jobId,
    expectedSha256: payload.fileHash,
    mimeType: payload.mimeType,
    originalFileName: payload.originalFileName,
    storageScope,
  });
}

async function runAnalysisForPayload(
  payload: AnalysisQueueJobPayload,
  buffer: Buffer,
) {
  const requestContext = {
    requestId: payload.requestId,
    batchId: payload.batchId,
    itemId: payload.itemId,
    fileName: payload.originalFileName,
  };

  if (payload.jobKind === 'version_update') {
    if (!payload.documentId) {
      throw new Error('documentId é obrigatório para análise de atualização.');
    }

    return analyzePdfUpdateBuffer({
      buffer,
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      companyId: payload.tenantId,
      documentId: payload.documentId,
      ownerUserId: payload.ownerUserId,
      membershipId: payload.membershipId,
      jobId: payload.jobId,
      requestContext,
    });
  }

  return analyzePdfBuffer({
    buffer,
    originalFileName: payload.originalFileName,
    mimeType: payload.mimeType,
    companyId: payload.tenantId,
    ownerUserId: payload.ownerUserId,
    jobId: payload.jobId,
    requestContext,
  });
}

async function processAnalysisJob(job: Job<AnalysisQueueJobPayload>): Promise<void> {
  const payload = job.data;
  const slotAcquired = await tryAcquireTenantAnalysisSlot(payload.tenantId);

  if (!slotAcquired) {
    await job.moveToDelayed(Date.now() + TENANT_SLOT_RETRY_DELAY_MS, job.token);
    throw new DelayedError('Limite de concorrência por tenant atingido.');
  }

  try {
    await markAnalysisJobProcessing(payload.jobId);

    const buffer = await loadJobBuffer(payload);
    const result = await runAnalysisForPayload(payload, buffer);

    await completeAnalysisJob({ jobId: payload.jobId, result });

    logger.info('analysis worker job completed', {
      jobId: payload.jobId,
      tenantId: payload.tenantId,
      jobKind: payload.jobKind ?? 'initial',
      status: result.status,
      aiProvider: resolveAnalysisProviderName(),
    });
  } catch (error) {
    if (error instanceof DelayedError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'unknown';
    await failAnalysisJob({
      jobId: payload.jobId,
      errorMessage: message,
      errorCode: error instanceof Error && 'code' in error ? String(error.code) : 'ANALYSIS_FAILED',
    });

    logger.error('analysis worker job failed', {
      jobId: payload.jobId,
      tenantId: payload.tenantId,
      jobKind: payload.jobKind ?? 'initial',
      message,
    });

    throw error;
  } finally {
    await releaseTenantAnalysisSlot(payload.tenantId);
  }
}

export function startInProcessAnalysisWorker(): void {
  if (workerStarted) return;
  if (!process.env.ANALYSIS_WORKER_IN_PROCESS?.trim()) return;

  const worker = startAnalysisWorker(processAnalysisJob);
  if (!worker) return;

  workerStarted = true;
  worker.on('failed', (job, error) => {
    if (error instanceof DelayedError) return;
    logger.warn('analysis worker failed event', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('Analysis worker iniciado no processo da API');
}

export async function runAnalysisWorkerLoop(): Promise<void> {
  const worker = startAnalysisWorker(processAnalysisJob);
  if (!worker) {
    throw new Error('Fila de análise indisponível — configure REDIS_URL e ANALYSIS_SYNC_FALLBACK=false');
  }

  worker.on('failed', (job, error) => {
    if (error instanceof DelayedError) return;
    logger.warn('analysis worker failed event', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('Analysis worker aguardando jobs');
}

export async function requeueAnalysisJob(jobId: string): Promise<void> {
  const payload = await loadAnalysisJobPayload(jobId);
  if (!payload) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  const { enqueueAnalysisJob } = await import('../queues/analysisQueue.js');
  await enqueueAnalysisJob(payload);
}
