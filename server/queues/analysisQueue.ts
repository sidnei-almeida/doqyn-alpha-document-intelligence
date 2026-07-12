import { Queue, Worker, type Job } from 'bullmq';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';
import { updateAnalysisQueueDepth } from '../metrics/phaseAMetrics.js';
import type { AnalysisQueueJobPayload } from '../services/analysis/analysisJobTypes.js';

const QUEUE_NAME = 'document-analysis';

let queue: Queue<AnalysisQueueJobPayload> | null = null;

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

export function isAnalysisSyncFallbackEnabled(): boolean {
  return readBool(process.env.ANALYSIS_SYNC_FALLBACK, process.env.NODE_ENV !== 'production');
}

export function isAnalysisQueueEnabled(): boolean {
  return isRedisEnabled() && Boolean(getRedisUrl()) && !isAnalysisSyncFallbackEnabled();
}

export function getAnalysisQueueConcurrencyGlobal(): number {
  return readPositiveInt(process.env.ANALYSIS_QUEUE_CONCURRENCY_GLOBAL, 10);
}

export function getAnalysisQueueConcurrencyPerTenant(): number {
  return readPositiveInt(process.env.ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT, 2);
}

export function getAnalysisJobTtlHours(): number {
  return readPositiveInt(process.env.ANALYSIS_JOB_TTL_HOURS, 24);
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de análise.');
  }
  return { url };
}

export async function getAnalysisQueue(): Promise<Queue<AnalysisQueueJobPayload> | null> {
  if (!isAnalysisQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<AnalysisQueueJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: getAnalysisJobTtlHours() * 3_600 },
      removeOnFail: { age: getAnalysisJobTtlHours() * 3_600 },
      attempts: 2,
      backoff: { type: 'exponential', delay: 2_000 },
    },
  });

  return queue;
}

export async function enqueueAnalysisJob(payload: AnalysisQueueJobPayload): Promise<void> {
  const analysisQueue = await getAnalysisQueue();
  if (!analysisQueue) {
    throw new Error('Fila de análise indisponível.');
  }

  await analysisQueue.add('analyze-pdf', payload, {
    jobId: payload.jobId,
  });
}

export async function getAnalysisQueueStats(): Promise<{ waiting: number; active: number }> {
  const analysisQueue = await getAnalysisQueue();
  if (!analysisQueue) {
    return { waiting: 0, active: 0 };
  }

  const counts = await analysisQueue.getJobCounts('waiting', 'active');
  const waiting = counts.waiting ?? 0;
  const active = counts.active ?? 0;
  updateAnalysisQueueDepth(waiting, active);
  return { waiting, active };
}

export type AnalysisJobProcessor = (job: Job<AnalysisQueueJobPayload>) => Promise<void>;

export function startAnalysisWorker(processor: AnalysisJobProcessor): Worker<AnalysisQueueJobPayload> | null {
  if (!isAnalysisQueueEnabled()) return null;

  return new Worker<AnalysisQueueJobPayload>(
    QUEUE_NAME,
    processor,
    {
      connection: getQueueConnection(),
      concurrency: getAnalysisQueueConcurrencyGlobal(),
    },
  );
}
