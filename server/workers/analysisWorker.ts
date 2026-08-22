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
  markAnalysisJobQueuedForRetry,
} from '../services/analysis/analysisJobService.js';
import type {
  AnalysisJobResult,
  AnalysisQueueJobPayload,
} from '../services/analysis/analysisJobTypes.js';
import { isGroqSaturationCode, isGroqSaturationError } from '../ai/utils/groqSaturation.js';
import { requeueAnalysisJobOnSaturation } from './analysisSaturationRequeue.js';
import { startAnalysisWorker } from '../queues/analysisQueue.js';
import {
  releaseTenantAnalysisSlot,
  tryAcquireTenantAnalysisSlot,
} from '../queues/analysisTenantConcurrency.js';
import { logger } from '../utils/logger.js';
import { recordAnalysisJobCompletion } from '../metrics/prometheus.js';
import {
  bufferMeta,
  pipelineError,
  pipelineInfo,
  summarizeError,
} from '../ai/utils/pipelineDebug.js';

const TENANT_SLOT_RETRY_DELAY_MS = 5_000;

let workerStarted = false;

async function loadJobBuffer(payload: AnalysisQueueJobPayload): Promise<Buffer> {
  if (!isStorageConfigured()) {
    throw new Error('Storage não configurado para processamento assíncrono.');
  }

  // O dono precisa acompanhar o tenant: em pessoa física o bucket é compartilhado e o
  // caminho do objeto é escopado por usuário, então sem `ownerUserId` o storage nem resolve.
  const storageScope = await resolveTenantStorageScopeById(payload.tenantId, payload.ownerUserId);
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

function isSaturationResult(result: AnalysisJobResult): boolean {
  return result.status === 'ai_unavailable' && isGroqSaturationCode(result.errorCode);
}

/**
 * Devolve o job para a fila e sinaliza ao chamador que ele deve lançar `DelayedError`.
 *
 * O `DelayedError` fica com o chamador de propósito: quem lança é quem está dentro do `try` do
 * worker, onde o `catch` já sabe repassá-lo sem marcar o job como falho.
 */
async function tryRequeueOnSaturation(
  job: Job<AnalysisQueueJobPayload>,
  payload: AnalysisQueueJobPayload,
  origin: 'result' | 'error',
  errorCode?: string,
): Promise<boolean> {
  const outcome = await requeueAnalysisJobOnSaturation({
    job,
    payload,
    origin,
    errorCode,
    markJobQueued: markAnalysisJobQueuedForRetry,
  });

  return outcome.requeued;
}

async function processAnalysisJob(job: Job<AnalysisQueueJobPayload>): Promise<void> {
  const payload = job.data;
  const jobKind = payload.jobKind ?? 'initial';
  const startedAt = Date.now();
  const slotAcquired = await tryAcquireTenantAnalysisSlot(payload.tenantId);

  if (!slotAcquired) {
    await job.moveToDelayed(Date.now() + TENANT_SLOT_RETRY_DELAY_MS, job.token);
    throw new DelayedError('Limite de concorrência por tenant atingido.');
  }

  try {
    await markAnalysisJobProcessing(payload.jobId);

    pipelineInfo('analysisWorker', 'job processing', {
      jobId: payload.jobId,
      tenantId: payload.tenantId,
      jobKind,
      attemptsMade: job.attemptsMade,
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      fileHashPrefix: payload.fileHash?.slice(0, 12),
      requestId: payload.requestId,
      batchId: payload.batchId,
      itemId: payload.itemId,
      documentId: payload.documentId,
    });

    const buffer = await loadJobBuffer(payload);

    pipelineInfo('analysisWorker', 'staging carregado', {
      jobId: payload.jobId,
      ...bufferMeta(buffer, 'pdf'),
    });

    const result = await runAnalysisForPayload(payload, buffer);

    // Saturação da vazão não é resultado: é o pedido que não chegou a ser atendido. Enquanto
    // houver crédito de reenfileiramento, o documento volta para a fila em vez de cair na revisão
    // manual como "IA indisponível".
    if (isSaturationResult(result)) {
      const requeued = await tryRequeueOnSaturation(job, payload, 'result', result.errorCode);
      if (requeued) {
        throw new DelayedError('Vazão da Groq saturada: análise devolvida à fila.');
      }
    }

    await completeAnalysisJob({ jobId: payload.jobId, result });

    recordAnalysisJobCompletion({
      jobKind,
      status: result.status,
      durationSeconds: (Date.now() - startedAt) / 1000,
    });

    pipelineInfo('analysisWorker', 'job completed', {
      jobId: payload.jobId,
      tenantId: payload.tenantId,
      jobKind,
      status: result.status,
      durationMs: Date.now() - startedAt,
      textSource: result.textExtraction?.source,
      ocrFallbackUsed: result.textExtraction?.ocrFallbackUsed,
      classId: result.classification?.classId,
      className: result.classification?.className,
      aiProvider: resolveAnalysisProviderName(),
    });

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

    // Mesma saturação, outro caminho: aqui ela chega como erro lançado (o 429 da Groq ou o teto de
    // espera do limitador local) em vez de resultado.
    if (isGroqSaturationError(error)) {
      const errorCode = String((error as { code?: unknown }).code);
      const requeued = await tryRequeueOnSaturation(job, payload, 'error', errorCode);
      if (requeued) {
        throw new DelayedError('Vazão da Groq saturada: análise devolvida à fila.');
      }
    }

    pipelineError('analysisWorker', 'job failed', error, {
      jobId: payload.jobId,
      tenantId: payload.tenantId,
      jobKind,
      attemptsMade: job.attemptsMade,
      durationMs: Date.now() - startedAt,
      ...summarizeError(error),
    });

    const message = error instanceof Error ? error.message : 'unknown';
    await failAnalysisJob({
      jobId: payload.jobId,
      errorMessage: message,
      errorCode: error instanceof Error && 'code' in error ? String(error.code) : 'ANALYSIS_FAILED',
    });

    recordAnalysisJobCompletion({
      jobKind,
      status: 'failed',
      durationSeconds: (Date.now() - startedAt) / 1000,
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
