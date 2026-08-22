import { Queue, Worker, type Job } from 'bullmq';
import { isEmbeddingEnabled } from '../ai/embeddings/embeddingConfig.js';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';

const QUEUE_NAME = 'document-embedding';

/**
 * Vetorizar uma versão inteira é um job só, não um por chunk: o custo dominante é carregar o
 * modelo, e o serviço já processa em lote.
 */
export type EmbeddingQueueJobPayload = {
  tenantId: string;
  documentId: string;
  versionId: string;
  userId?: string;
  membershipId?: string;
};

let queue: Queue<EmbeddingQueueJobPayload> | null = null;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Sem Redis não há fila, e o embedding **não** cai para execução síncrona: ele custa segundos e
 * ~280 MB de modelo, que não podem entrar no processo que responde o request. Sem fila, chunk
 * novo nasce sem vetor e `scripts/rag-embed-backfill.ts` resolve depois — a busca semântica fica
 * atrasada, o upload continua rápido.
 */
export function isEmbeddingQueueEnabled(): boolean {
  return isEmbeddingEnabled() && isRedisEnabled() && Boolean(getRedisUrl());
}

export function getEmbeddingQueueConcurrency(): number {
  return readPositiveInt(process.env.EMBEDDING_QUEUE_CONCURRENCY, 1);
}

export function getEmbeddingJobTtlHours(): number {
  return readPositiveInt(process.env.EMBEDDING_JOB_TTL_HOURS, 24);
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de embedding.');
  }
  return { url };
}

export async function getEmbeddingQueue(): Promise<Queue<EmbeddingQueueJobPayload> | null> {
  if (!isEmbeddingQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<EmbeddingQueueJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: getEmbeddingJobTtlHours() * 3_600 },
      removeOnFail: { age: getEmbeddingJobTtlHours() * 3_600 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  });

  return queue;
}

export function buildEmbeddingJobId(payload: EmbeddingQueueJobPayload): string {
  return `embed_${payload.documentId}_${payload.versionId}`;
}

/**
 * O `jobId` é derivado de documento + versão: reconfirmar a mesma versão não enfileira duas
 * vezes, e um job já vetorizado que voltar à fila só encontra zero chunks pendentes.
 */
export async function enqueueEmbeddingJob(payload: EmbeddingQueueJobPayload): Promise<boolean> {
  const embeddingQueue = await getEmbeddingQueue();
  if (!embeddingQueue) return false;

  await embeddingQueue.add('embed-document-version', payload, {
    jobId: buildEmbeddingJobId(payload),
  });
  return true;
}

export async function getEmbeddingQueueStats(): Promise<{ waiting: number; active: number }> {
  const embeddingQueue = await getEmbeddingQueue();
  if (!embeddingQueue) return { waiting: 0, active: 0 };

  const counts = await embeddingQueue.getJobCounts('waiting', 'active');
  return { waiting: counts.waiting ?? 0, active: counts.active ?? 0 };
}

export type EmbeddingJobProcessor = (job: Job<EmbeddingQueueJobPayload>) => Promise<void>;

export function startEmbeddingWorker(
  processor: EmbeddingJobProcessor,
): Worker<EmbeddingQueueJobPayload> | null {
  if (!isEmbeddingQueueEnabled()) return null;

  return new Worker<EmbeddingQueueJobPayload>(QUEUE_NAME, processor, {
    connection: getQueueConnection(),
    // Concorrência 1 por padrão: o modelo é um singleton por processo e a inferência é CPU-bound.
    // Rodar dois jobs juntos disputa o mesmo núcleo e ainda concorre com a análise no mesmo host.
    concurrency: getEmbeddingQueueConcurrency(),
  });
}
