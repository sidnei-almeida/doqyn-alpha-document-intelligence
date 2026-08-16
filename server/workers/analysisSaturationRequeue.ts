import type { AnalysisQueueJobPayload } from '../services/analysis/analysisJobTypes.js';
import { recordAnalysisSaturationRequeue } from '../metrics/prometheus.js';
import { logger } from '../utils/logger.js';

/**
 * Devolver o job para a fila quando a vazão da Groq satura.
 *
 * Concluir o documento como `ai_unavailable` é o mesmo que dizer "deu erro" para uma coisa que é
 * só lentidão: o documento cai na revisão manual e, sob carga, o lote inteiro vira trabalho humano.
 * Aqui o job volta para a fila — a espera continua espera.
 *
 * O contador de reenfileiramentos vive no payload do job (Redis, via `updateData`) e não nas
 * tentativas do BullMQ: `moveToDelayed` não conta como tentativa, e as tentativas existentes
 * ficam reservadas para falha de verdade.
 */

const DEFAULT_MAX_REQUEUES = 5;
const DEFAULT_BASE_DELAY_MS = 30_000;
/** Teto do recuo. Mais que isso e o usuário desiste antes de a análise voltar. */
const MAX_DELAY_MS = 300_000;
/**
 * Dispersão. Sem ela um lote saturado volta inteiro no mesmo instante e satura de novo — a fila
 * bate na parede em bloco em vez de escoar.
 */
const JITTER_MS = 5_000;

/** Interface mínima do job do BullMQ — o que este módulo usa, e o que o teste consegue forjar. */
export type SaturationRequeueableJob = {
  token?: string;
  updateData(data: AnalysisQueueJobPayload): Promise<void>;
  moveToDelayed(timestamp: number, token?: string): Promise<void>;
};

function readNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Zero desliga o reenfileiramento e restaura o comportamento antigo. */
export function getSaturationMaxRequeues(): number {
  return readNonNegativeInt(process.env.ANALYSIS_SATURATION_MAX_REQUEUES, DEFAULT_MAX_REQUEUES);
}

export function getSaturationBaseDelayMs(): number {
  return readPositiveInt(process.env.ANALYSIS_SATURATION_RETRY_DELAY_MS, DEFAULT_BASE_DELAY_MS);
}

/**
 * Recuo progressivo a partir da base, dobrando a cada volta e limitado ao teto. A base é da ordem
 * da janela do limitador (um minuto): voltar antes disso é reencontrar a mesma janela cheia.
 */
export function saturationRetryDelayMs(requeues: number, random: () => number = Math.random): number {
  const base = getSaturationBaseDelayMs();
  const backoff = Math.min(base * 2 ** Math.max(requeues, 0), MAX_DELAY_MS);
  return backoff + Math.floor(random() * JITTER_MS);
}

export type SaturationRequeueOutcome =
  | { requeued: false; attempt: number; maxRequeues: number }
  | { requeued: true; attempt: number; maxRequeues: number; delayMs: number };

/**
 * Devolve o job para a fila se ainda houver crédito de reenfileiramento.
 *
 * Passado o teto, devolve `requeued: false` e o chamador segue com o caminho antigo — em algum
 * momento a saturação deixa de ser pico e vira estado, e aí o usuário precisa saber.
 */
export async function requeueAnalysisJobOnSaturation(input: {
  job: SaturationRequeueableJob;
  payload: AnalysisQueueJobPayload;
  /** Onde a saturação apareceu: no resultado da análise ou num erro lançado. */
  origin: 'result' | 'error';
  errorCode?: string;
  markJobQueued: (jobId: string) => Promise<void>;
  now?: () => number;
  random?: () => number;
}): Promise<SaturationRequeueOutcome> {
  const maxRequeues = getSaturationMaxRequeues();
  const attempt = (input.payload.saturationRequeues ?? 0) + 1;

  if (attempt > maxRequeues) {
    logger.warn('analysis job saturation requeue limit reached', {
      jobId: input.payload.jobId,
      tenantId: input.payload.tenantId,
      origin: input.origin,
      errorCode: input.errorCode,
      attempt,
      maxRequeues,
    });
    return { requeued: false, attempt, maxRequeues };
  }

  const now = input.now ?? Date.now;
  const delayMs = saturationRetryDelayMs(attempt - 1, input.random);

  // A ordem importa: o job Mongo volta a `queued` antes de sair da fila, senão a próxima tentativa
  // encontra o job em `processing` e `markAnalysisJobProcessing` recusa a transição.
  await input.markJobQueued(input.payload.jobId);
  await input.job.updateData({ ...input.payload, saturationRequeues: attempt });
  await input.job.moveToDelayed(now() + delayMs, input.job.token);

  recordAnalysisSaturationRequeue({ jobKind: input.payload.jobKind ?? 'initial' });

  logger.warn('analysis job requeued after groq saturation', {
    jobId: input.payload.jobId,
    tenantId: input.payload.tenantId,
    origin: input.origin,
    errorCode: input.errorCode,
    attempt,
    maxRequeues,
    delayMs,
  });

  return { requeued: true, attempt, maxRequeues, delayMs };
}
