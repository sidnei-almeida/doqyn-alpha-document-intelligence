import { Queue, Worker, type Job } from 'bullmq';
import { getRedisUrl, isRedisEnabled } from '../redis/redisConfig.js';
import { listActiveTenants } from '../services/tenantsService.js';
import { evaluateTenantExpiryAlerts } from '../services/expiry/documentExpiryAlertService.js';
import { logger } from '../utils/logger.js';

const QUEUE_NAME = 'document-expiry-alerts';
const REPEATABLE_JOB_NAME = 'daily-expiry-sweep';

export type ExpiryAlertJobPayload = {
  /** Ausente = varrer todos os tenants ativos. Presente = reavaliar um tenant sob demanda. */
  tenantId?: string;
};

let queue: Queue<ExpiryAlertJobPayload> | null = null;
let workerStarted = false;

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function isExpiryAlertQueueEnabled(): boolean {
  return (
    readBool(process.env.EXPIRY_ALERTS_ENABLED, true) && isRedisEnabled() && Boolean(getRedisUrl())
  );
}

/**
 * Cron da varredura diária. Padrão: 03:00, fora do horário de uso — a varredura lê documentos de
 * todos os tenants e não deve disputar CPU com o produto num VPS de 2 vCPU.
 */
export function getExpiryAlertCron(): string {
  return process.env.EXPIRY_ALERTS_CRON?.trim() || '0 3 * * *';
}

function getQueueConnection() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error('REDIS_URL é obrigatório para a fila de alertas de vencimento.');
  }
  return { url };
}

export async function getExpiryAlertQueue(): Promise<Queue<ExpiryAlertJobPayload> | null> {
  if (!isExpiryAlertQueueEnabled()) return null;
  if (queue) return queue;

  queue = new Queue<ExpiryAlertJobPayload>(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: 7 * 24 * 3_600, count: 50 },
      removeOnFail: { age: 14 * 24 * 3_600 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  });

  return queue;
}

/**
 * Registra a varredura recorrente.
 *
 * Usa `jobId` fixo: várias réplicas da API subindo ao mesmo tempo registram o mesmo repeatable
 * uma vez só, em vez de multiplicar a varredura pelo número de processos.
 */
export async function scheduleDailyExpirySweep(): Promise<void> {
  const target = await getExpiryAlertQueue();
  if (!target) return;

  const cron = getExpiryAlertCron();

  // Remove agendamentos antigos antes de registrar: sem isto, mudar EXPIRY_ALERTS_CRON deixaria
  // os dois padrões ativos ao mesmo tempo.
  for (const existing of await target.getRepeatableJobs()) {
    if (existing.name === REPEATABLE_JOB_NAME && existing.pattern !== cron) {
      await target.removeRepeatableByKey(existing.key);
    }
  }

  await target.add(
    REPEATABLE_JOB_NAME,
    {},
    { repeat: { pattern: cron }, jobId: REPEATABLE_JOB_NAME },
  );

  logger.info('daily expiry sweep scheduled', { cron });
}

/** Reavaliação sob demanda de um tenant — usada quando um vencimento é corrigido à mão. */
export async function enqueueTenantExpiryEvaluation(tenantId: string): Promise<boolean> {
  const target = await getExpiryAlertQueue();
  if (!target) return false;

  await target.add(
    'tenant-expiry-evaluation',
    { tenantId },
    {
      // Colapsa rajadas: editar cinco documentos seguidos não gera cinco varreduras do tenant.
      jobId: `expiry-eval-${tenantId}`,
      delay: 30_000,
      // `removeOnComplete: true` é obrigatório junto do jobId fixo. O BullMQ devolve o job
      // existente enquanto a chave existir, e o padrão da fila mantém concluídos por 7 dias —
      // sem isto, a primeira reavaliação de um tenant bloquearia todas as seguintes por uma
      // semana, silenciosamente.
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  return true;
}

export async function runExpiryAlertJob(payload: ExpiryAlertJobPayload): Promise<void> {
  if (payload.tenantId) {
    const result = await evaluateTenantExpiryAlerts(payload.tenantId);
    logger.info('expiry alerts evaluated for tenant', { tenantId: payload.tenantId, ...result });
    return;
  }

  const tenants = await listActiveTenants();
  let alertsCreated = 0;

  for (const tenant of tenants) {
    try {
      const result = await evaluateTenantExpiryAlerts(tenant.tenantId);
      alertsCreated += result.alertsCreated;
    } catch (error) {
      // Um tenant com dado inconsistente não pode interromper a varredura dos demais.
      logger.error('expiry sweep failed for tenant', {
        tenantId: tenant.tenantId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  logger.info('daily expiry sweep completed', { tenants: tenants.length, alertsCreated });
}

export function startExpiryAlertWorker(): void {
  if (workerStarted || !isExpiryAlertQueueEnabled()) return;
  workerStarted = true;

  const worker = new Worker<ExpiryAlertJobPayload>(
    QUEUE_NAME,
    async (job: Job<ExpiryAlertJobPayload>) => {
      await runExpiryAlertJob(job.data ?? {});
    },
    // Concorrência 1 de propósito: é trabalho de fundo num VPS de 2 vCPU e não tem pressa.
    { connection: getQueueConnection(), concurrency: 1 },
  );

  worker.on('failed', (job, error) => {
    logger.error('expiry alert job failed', {
      jobId: job?.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  logger.info('expiry alert worker started');
}
