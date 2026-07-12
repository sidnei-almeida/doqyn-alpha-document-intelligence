import { createHash } from 'node:crypto';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import { isStorageConfigured, storeAnalysisStaging } from '../../storage/index.js';
import { isAnalysisQueueEnabled, enqueueAnalysisJob } from '../../queues/analysisQueue.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  createAnalysisJobId,
  createQueuedAnalysisJob,
  failAnalysisJob,
  type AnalysisEnqueueResponse,
} from './analysisJobService.js';
import type { AnalysisJobKind } from './analysisJobTypes.js';

export function isAsyncPdfAnalysisAvailable(): boolean {
  return isAnalysisQueueEnabled() && isStorageConfigured();
}

export async function enqueuePdfAnalysisJob(input: {
  tenantId: string;
  ownerUserId: string;
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  storageScope?: TenantStorageScope;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
}): Promise<AnalysisEnqueueResponse> {
  if (!isAsyncPdfAnalysisAvailable()) {
    throw new ServiceError(
      'Fila de análise indisponível. Configure Redis, storage e ANALYSIS_SYNC_FALLBACK=false.',
      'ANALYSIS_QUEUE_UNAVAILABLE',
      503,
    );
  }

  const jobId = createAnalysisJobId();
  const fileHash = createHash('sha256').update(input.buffer).digest('hex');

  await storeAnalysisStaging({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  });

  const queued = await createQueuedAnalysisJob({
    jobId,
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    fileHash,
    fileSizeBytes: input.buffer.length,
    requestId: input.requestId,
    batchId: input.batchId,
    itemId: input.itemId,
    jobKind: input.jobKind ?? 'initial',
    documentId: input.documentId,
    membershipId: input.membershipId,
  });

  try {
    await enqueueAnalysisJob({
      jobId,
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileHash,
      fileSizeBytes: input.buffer.length,
      requestId: input.requestId,
      batchId: input.batchId,
      itemId: input.itemId,
      jobKind: input.jobKind ?? 'initial',
      documentId: input.documentId,
      membershipId: input.membershipId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enfileirar análise.';
    await failAnalysisJob({
      jobId,
      errorCode: 'ANALYSIS_ENQUEUE_FAILED',
      errorMessage: message,
    });
    throw error;
  }

  return queued;
}
