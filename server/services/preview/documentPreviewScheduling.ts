import {
  buildPendingPreviewSlot,
  generateDocumentPreviewForVersion,
  type GenerateDocumentPreviewInput,
  type GenerateDocumentPreviewResult,
} from '../documentPreviewService.js';
import { enqueuePreviewJob, isPreviewQueueEnabled } from '../../queues/previewQueue.js';
import type { PreviewQueueJobPayload } from './previewJobTypes.js';

export type ScheduleDocumentPreviewInput = GenerateDocumentPreviewInput & {
  ownerUserId: string;
  requestId?: string;
};

export type ScheduleDocumentPreviewResult = GenerateDocumentPreviewResult & {
  asyncQueued: boolean;
};

function buildPreviewJobId(input: ScheduleDocumentPreviewInput): string {
  return `${input.tenantId}:${input.documentId}:${input.versionId}`;
}

function toPreviewPayload(input: ScheduleDocumentPreviewInput): PreviewQueueJobPayload {
  return {
    jobId: buildPreviewJobId(input),
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    contentType: input.contentType,
    previewStorageFileName: input.previewStorageFileName,
    requestId: input.requestId,
  };
}

/** Gera preview de forma síncrona ou marca como pending para fila assíncrona. */
export async function scheduleDocumentPreviewForVersion(
  input: ScheduleDocumentPreviewInput,
): Promise<ScheduleDocumentPreviewResult> {
  if (!isPreviewQueueEnabled()) {
    const result = await generateDocumentPreviewForVersion(input);
    return { ...result, asyncQueued: false };
  }

  return {
    slot: buildPendingPreviewSlot(input.primary, input.versionId),
    previewManifest: null,
    asyncQueued: true,
  };
}

/** Enfileira job após persistência da versão no MongoDB. */
export async function enqueueScheduledDocumentPreview(
  input: ScheduleDocumentPreviewInput,
): Promise<void> {
  await enqueuePreviewJob(toPreviewPayload(input));
}
