import { Queue, Worker, type Job } from 'bullmq';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';

/**
 * Promoção do arquivo confirmado: do provisório (`tmp/<jobId>`) para a chave definitiva da versão.
 *
 * A confirmação deixou de esperar por isto. Ela grava a versão apontando para o próprio provisório —
 * um objeto válido, no mesmo bucket, que todo leitor já sabe abrir — e responde. Esta fila copia
 * dentro do R2, sem baixar, troca o endereço no Mongo e apaga o provisório com atraso.
 *
 * Antes o request da confirmação baixava o arquivo inteiro, subia de novo para a chave final e
 * apagava o provisório: de 2 a 4 s de R2 medidos com a pessoa olhando a tela.
 */
export type StoragePromotionJobPayload = {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  bucket: string;
  stagingKey: string;
  destinationKey: string;
  contentType?: string;
  requestId?: string;
};

const QUEUE_NAME = 'document-storage-promotion';

export const STORAGE_PROMOTION_JOB_NAMES = {
  promote: 'promote',
  cleanup: 'cleanup-staging',
  /**
   * Cópia para o segundo storage, depois que a versão já está no endereço definitivo.
   *
   * Mora nesta fila, e não numa própria, porque é o mesmo assunto — onde o arquivo está — e assim
   * herda a política de retry e de descarte que já foi pensada aqui. O espelho é sempre o último
   * da sequência: só faz sentido copiar o que já ficou de pé.
   */
  mirror: 'mirror',
} as const;

let queue: Queue<StoragePromotionJobPayload> | null = null;

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

/**
 * Sem Redis a confirmação volta a copiar dentro do request, como antes. `STORAGE_PROMOTION_ASYNC=false`
 * força esse caminho mesmo com Redis — a saída de emergência se a fila der problema.
 */
export function isStoragePromotionQueueEnabled(): boolean {
  return (
    isRedisEnabled() &&
    Boolean(getRedisUrl()) &&
    readBool(process.env.STORAGE_PROMOTION_ASYNC, true)
  );
}

/**
 * Quanto o provisório sobrevive depois da troca de endereço.
 *
 * Quem leu a versão um instante antes da troca ainda pode estar baixando pelo endereço antigo; apagar
 * na hora cortaria esse download no meio.
 */
export function getStagingCleanupDelayMs(): number {
  return readPositiveInt(process.env.STORAGE_STAGING_CLEANUP_DELAY_MS, 10 * 60_000);
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de promoção de storage.');
  }
  return { url };
}

async function getStoragePromotionQueue(): Promise<Queue<StoragePromotionJobPayload> | null> {
  if (!isStoragePromotionQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<StoragePromotionJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: 24 * 3_600 },
      removeOnFail: { age: 7 * 24 * 3_600 },
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  });

  return queue;
}

export async function enqueueStoragePromotionJob(
  payload: StoragePromotionJobPayload,
): Promise<void> {
  const promotionQueue = await getStoragePromotionQueue();
  if (!promotionQueue) {
    throw new Error('Fila de promoção de storage indisponível.');
  }

  await promotionQueue.add(STORAGE_PROMOTION_JOB_NAMES.promote, payload, {
    jobId: `promote-${payload.versionId}`,
  });
}

/**
 * Enfileira a cópia para o espelho. Silenciosa quando a fila não existe.
 *
 * Diferente das outras duas, esta não lança: o espelho é conveniência, e não poder enfileirá-lo
 * não pode derrubar um caminho que já entregou o documento ao acervo.
 */
export async function enqueueStorageMirrorJob(payload: StoragePromotionJobPayload): Promise<void> {
  const promotionQueue = await getStoragePromotionQueue();
  if (!promotionQueue) return;

  await promotionQueue.add(STORAGE_PROMOTION_JOB_NAMES.mirror, payload, {
    jobId: `mirror-${payload.versionId}`,
  });
}

export async function enqueueStagingCleanupJob(payload: StoragePromotionJobPayload): Promise<void> {
  const promotionQueue = await getStoragePromotionQueue();
  if (!promotionQueue) {
    throw new Error('Fila de promoção de storage indisponível.');
  }

  await promotionQueue.add(STORAGE_PROMOTION_JOB_NAMES.cleanup, payload, {
    jobId: `cleanup-${payload.versionId}`,
    delay: getStagingCleanupDelayMs(),
  });
}

export type StoragePromotionJobProcessor = (job: Job<StoragePromotionJobPayload>) => Promise<void>;

export function startStoragePromotionWorker(
  processor: StoragePromotionJobProcessor,
): Worker<StoragePromotionJobPayload> | null {
  if (!isStoragePromotionQueueEnabled()) return null;

  return new Worker<StoragePromotionJobPayload>(QUEUE_NAME, processor, {
    connection: getQueueConnection(),
    concurrency: readPositiveInt(process.env.STORAGE_PROMOTION_CONCURRENCY, 4),
  });
}
