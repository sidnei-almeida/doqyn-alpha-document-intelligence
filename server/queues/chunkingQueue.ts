import { Queue, Worker, type Job } from 'bullmq';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';

const QUEUE_NAME = 'document-chunking';

/**
 * Fatiar o PDF é CPU e bloqueia o event loop enquanto roda.
 *
 * Dentro do request de confirmação isso custava os 4,4s medidos na auditoria de escala — e o custo
 * não é só de quem confirma: enquanto o `pdf-parse` roda, o processo da API não atende mais
 * ninguém. Aqui o trabalho vai para onde a pilha de IA já mora.
 *
 * Um job por versão, não por trecho: o custo dominante é ler o PDF uma vez.
 */
export type ChunkingQueueJobPayload = {
  tenantId: string;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  createdBy: string;
  isCurrentVersion: boolean;
  mimeType?: string;
  userId?: string;
  membershipId?: string;
};

let queue: Queue<ChunkingQueueJobPayload> | null = null;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Sem Redis não há fila e o fatiamento volta a acontecer no request — ao contrário do embedding,
 * que aceita nascer atrasado. Trecho alimenta busca por texto e RAG, não existe backfill de
 * trechos, e um documento confirmado sem trecho é um documento que some da busca.
 */
export function isChunkingQueueEnabled(): boolean {
  return isRedisEnabled() && Boolean(getRedisUrl());
}

export function getChunkingQueueConcurrency(): number {
  return readPositiveInt(process.env.CHUNKING_QUEUE_CONCURRENCY, 1);
}

export function getChunkingJobTtlHours(): number {
  return readPositiveInt(process.env.CHUNKING_JOB_TTL_HOURS, 24);
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de fatiamento.');
  }
  return { url };
}

export async function getChunkingQueue(): Promise<Queue<ChunkingQueueJobPayload> | null> {
  if (!isChunkingQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<ChunkingQueueJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: getChunkingJobTtlHours() * 3_600 },
      removeOnFail: { age: getChunkingJobTtlHours() * 3_600 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  });

  return queue;
}

export function buildChunkingJobId(payload: ChunkingQueueJobPayload): string {
  return `chunk_${payload.documentId}_${payload.versionId}`;
}

/**
 * `jobId` derivado de documento + versão: reconfirmar a mesma versão não fatia duas vezes.
 * Devolve `false` quando não há fila — aí o chamador fatia inline.
 */
export async function enqueueChunkingJob(payload: ChunkingQueueJobPayload): Promise<boolean> {
  const chunkingQueue = await getChunkingQueue();
  if (!chunkingQueue) return false;

  await chunkingQueue.add('chunk-document-version', payload, {
    jobId: buildChunkingJobId(payload),
  });
  return true;
}

export async function getChunkingQueueStats(): Promise<{ waiting: number; active: number }> {
  const chunkingQueue = await getChunkingQueue();
  if (!chunkingQueue) return { waiting: 0, active: 0 };

  const counts = await chunkingQueue.getJobCounts('waiting', 'active');
  return { waiting: counts.waiting ?? 0, active: counts.active ?? 0 };
}

export type ChunkingJobProcessor = (job: Job<ChunkingQueueJobPayload>) => Promise<void>;

export function startChunkingWorker(
  processor: ChunkingJobProcessor,
): Worker<ChunkingQueueJobPayload> | null {
  if (!isChunkingQueueEnabled()) return null;

  return new Worker<ChunkingQueueJobPayload>(QUEUE_NAME, processor, {
    connection: getQueueConnection(),
    // Concorrência 1 por padrão: o fatiamento é CPU e divide o processo com a análise e o
    // embedding. Subir aqui é trocar latência de análise por vazão de fatiamento.
    concurrency: getChunkingQueueConcurrency(),
  });
}
