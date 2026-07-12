import { Queue, Worker, type Job } from 'bullmq';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';
import { updatePreviewQueueDepth } from '../metrics/phaseAMetrics.js';
import type { PreviewQueueJobPayload } from '../services/preview/previewJobTypes.js';

const QUEUE_NAME = 'document-preview';

let queue: Queue<PreviewQueueJobPayload> | null = null;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function isPreviewSyncFallbackEnabled(): boolean {
  return readBool(process.env.PREVIEW_SYNC_FALLBACK, process.env.NODE_ENV !== 'production');
}

export function isPreviewQueueEnabled(): boolean {
  return isRedisEnabled() && Boolean(getRedisUrl()) && !isPreviewSyncFallbackEnabled();
}

export function getPreviewQueueConcurrencyGlobal(): number {
  return readPositiveInt(process.env.PREVIEW_QUEUE_CONCURRENCY_GLOBAL, 4);
}

export function getPreviewJobTtlHours(): number {
  return readPositiveInt(process.env.PREVIEW_JOB_TTL_HOURS, 24);
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de preview.');
  }
  return { url };
}

export async function getPreviewQueue(): Promise<Queue<PreviewQueueJobPayload> | null> {
  if (!isPreviewQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<PreviewQueueJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: getPreviewJobTtlHours() * 3_600 },
      removeOnFail: { age: getPreviewJobTtlHours() * 3_600 },
      attempts: 2,
      backoff: { type: 'exponential', delay: 3_000 },
    },
  });

  return queue;
}

export async function enqueuePreviewJob(payload: PreviewQueueJobPayload): Promise<void> {
  const previewQueue = await getPreviewQueue();
  if (!previewQueue) {
    throw new Error('Fila de preview indisponível.');
  }

  await previewQueue.add('generate-preview', payload, {
    jobId: payload.jobId,
  });
}

export async function getPreviewQueueStats(): Promise<{ waiting: number; active: number }> {
  const previewQueue = await getPreviewQueue();
  if (!previewQueue) {
    return { waiting: 0, active: 0 };
  }

  const counts = await previewQueue.getJobCounts('waiting', 'active');
  const waiting = counts.waiting ?? 0;
  const active = counts.active ?? 0;
  updatePreviewQueueDepth(waiting, active);
  return { waiting, active };
}

export type PreviewJobProcessor = (job: Job<PreviewQueueJobPayload>) => Promise<void>;

export function startPreviewWorker(processor: PreviewJobProcessor): Worker<PreviewQueueJobPayload> | null {
  if (!isPreviewQueueEnabled()) return null;

  return new Worker<PreviewQueueJobPayload>(QUEUE_NAME, processor, {
    connection: getQueueConnection(),
    concurrency: getPreviewQueueConcurrencyGlobal(),
  });
}
