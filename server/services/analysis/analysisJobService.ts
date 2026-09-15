import { nanoid } from 'nanoid';
import type { Collection } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { AnalysisJobResult } from './analysisJobTypes.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import type {
  AnalysisEnqueueResponse,
  AnalysisJobKind,
  AnalysisJobPollResponse,
  AnalysisJobStatus,
  AnalysisQueueJobPayload,
  MongoAnalysisJob,
} from './analysisJobTypes.js';

const inMemoryJobs = new Map<string, MongoAnalysisJob>();

async function getAnalysisJobsCollection(): Promise<Collection<MongoAnalysisJob> | null> {
  if (!isMongoNativeConfigured()) return null;
  const db = await getDb();
  return db.collection<MongoAnalysisJob>(SHARED_APP_COLLECTIONS.analysisJobs);
}

function buildPollUrl(jobId: string): string {
  return `/api/ai/jobs/${jobId}`;
}

/** Quantas conclusões recentes entram na média de duração. */
const DURATION_SAMPLE_SIZE = 20;
/** Conclusão mais velha que isto não diz nada sobre a vazão de agora (provedor, carga, deploy). */
const DURATION_SAMPLE_MAX_AGE_MS = 60 * 60_000;
/**
 * A duração média é a mesma para todo mundo que consulta, e a consulta acontece a cada segundo ou
 * dois por arquivo em voo. Sem este cache, cada arquivo pagaria uma leitura no Mongo por consulta.
 */
const DURATION_CACHE_MS = 15_000;

let durationCache: { averageMs: number | null; expiresAt: number } | null = null;

/**
 * Quanto uma análise leva, do início no worker à conclusão.
 *
 * Antes a estimativa vinha de "conclusões nos últimos 10 minutos ÷ 10": isso mede quanto trabalho
 * **chegou**, não quanto cada um **custa**. Com a plataforma quase parada — duas análises em dez
 * minutos —, dava 0,2 por minuto e o documento que ia levar 3 s aparecia como "Na vez · ~5 min".
 * Quanto menos movimento, pior o número; o contrário do que a tela precisa dizer.
 */
async function measureAverageJobDurationMs(
  collection: Collection<MongoAnalysisJob>,
  now: number,
): Promise<number | null> {
  if (durationCache && durationCache.expiresAt > now) {
    return durationCache.averageMs;
  }

  const recent = await collection
    .find(
      {
        status: { $in: ['completed', 'requires_review', 'ai_unavailable'] },
        completedAt: { $gte: new Date(now - DURATION_SAMPLE_MAX_AGE_MS) },
      },
      { projection: { startedAt: 1, completedAt: 1 } },
    )
    .sort({ completedAt: -1 })
    .limit(DURATION_SAMPLE_SIZE)
    .toArray();

  const durations = recent
    .map((job) =>
      job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : NaN,
    )
    .filter((ms) => Number.isFinite(ms) && ms > 0);

  // Sem conclusão recente não há duração observada. `null` some com a estimativa na tela em vez de
  // mostrar um número inventado.
  const averageMs =
    durations.length > 0 ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length : null;
  durationCache = { averageMs, expiresAt: now + DURATION_CACHE_MS };
  return averageMs;
}

function readAnalysisConcurrency(): number {
  // Mesma variável e mesmo padrão de `getAnalysisQueueConcurrencyGlobal`; lida aqui para o serviço de
  // job não depender do módulo da fila.
  const parsed = Number(process.env.ANALYSIS_QUEUE_CONCURRENCY_GLOBAL);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10;
}

/**
 * A espera, em segundos, a partir da duração média observada.
 *
 * Quem está sendo analisado espera o que falta da média. Quem está na fila espera as rodadas até a
 * vez dele — o worker analisa `concurrency` documentos por vez — mais a própria análise.
 */
export function estimateAnalysisWaitSeconds(input: {
  status: 'queued' | 'processing';
  ahead: number;
  averageDurationMs: number;
  concurrency: number;
  elapsedMs?: number;
}): number {
  const average = Math.max(input.averageDurationMs, 1);
  if (input.status === 'processing') {
    return Math.max(1, Math.round((average - (input.elapsedMs ?? 0)) / 1000));
  }
  const concurrency = Math.max(1, Math.floor(input.concurrency));
  const rounds = Math.floor(Math.max(0, input.ahead) / concurrency) + 1;
  return Math.max(1, Math.round((rounds * average) / 1000));
}

/**
 * Onde o documento está na fila e quanto isso deve custar de espera.
 *
 * Sem isso a tela mostra "Analisando com IA…" tanto para quem está sendo processado agora quanto
 * para quem é o número 400 — e espera longa indistinguível de travamento é o que faz o usuário
 * recarregar a página e reenviar, aumentando a carga que ele está esperando escoar.
 */
async function buildQueueInsight(job: MongoAnalysisJob): Promise<{
  queuePosition?: number;
  estimatedWaitSeconds?: number | null;
}> {
  if (job.status !== 'queued' && job.status !== 'processing') return {};

  const collection = await getAnalysisJobsCollection();
  if (!collection) return {};

  const now = Date.now();

  // Quem já está sendo analisado tem posição zero: não espera fila, espera a IA.
  const ahead =
    job.status === 'processing'
      ? 0
      : await collection.countDocuments({
          status: 'queued',
          createdAt: { $lt: job.createdAt },
        });

  const averageDurationMs = await measureAverageJobDurationMs(collection, now);
  if (!averageDurationMs) {
    return { queuePosition: ahead, estimatedWaitSeconds: null };
  }

  const estimatedWaitSeconds = estimateAnalysisWaitSeconds({
    status: job.status,
    ahead,
    averageDurationMs,
    concurrency: readAnalysisConcurrency(),
    elapsedMs: job.startedAt ? now - new Date(job.startedAt).getTime() : 0,
  });
  return { queuePosition: ahead, estimatedWaitSeconds };
}

function toPollResponse(job: MongoAnalysisJob): AnalysisJobPollResponse {
  const terminal =
    job.status === 'completed' ||
    job.status === 'requires_review' ||
    job.status === 'ai_unavailable' ||
    job.status === 'failed';

  return {
    jobId: job._id,
    status: job.status,
    progress: job.progress,
    pollUrl: buildPollUrl(job._id),
    result: terminal && job.result ? job.result : undefined,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
  };
}

export function createAnalysisJobId(): string {
  return `job_${nanoid(16)}`;
}

export async function createQueuedAnalysisJob(input: {
  tenantId: string;
  ownerUserId: string;
  originalFileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  stagingKey?: string;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
}): Promise<AnalysisEnqueueResponse> {
  const jobId = input.jobId ?? createAnalysisJobId();
  const now = new Date();

  const job: MongoAnalysisJob = {
    _id: jobId,
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    status: 'queued',
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    fileHash: input.fileHash,
    fileSizeBytes: input.fileSizeBytes,
    stagingKey: input.stagingKey,
    requestId: input.requestId,
    batchId: input.batchId,
    itemId: input.itemId,
    jobKind: input.jobKind ?? 'initial',
    documentId: input.documentId,
    membershipId: input.membershipId,
    progress: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };

  const collection = await getAnalysisJobsCollection();
  if (collection) {
    await collection.insertOne(job);
  } else {
    inMemoryJobs.set(jobId, job);
  }

  return {
    jobId,
    status: 'queued',
    pollUrl: buildPollUrl(jobId),
  };
}

export async function getAnalysisJobForUser(input: {
  jobId: string;
  tenantId: string;
  ownerUserId: string;
}): Promise<AnalysisJobPollResponse | null> {
  const collection = await getAnalysisJobsCollection();
  const job = collection
    ? await collection.findOne({
        _id: input.jobId,
        tenantId: input.tenantId,
        ownerUserId: input.ownerUserId,
      })
    : inMemoryJobs.get(input.jobId) ?? null;

  if (!job) return null;
  if (job.tenantId !== input.tenantId || job.ownerUserId !== input.ownerUserId) {
    return null;
  }

  return { ...toPollResponse(job), ...(await buildQueueInsight(job)) };
}

export async function markAnalysisJobProcessing(jobId: string): Promise<void> {
  const now = new Date();
  const collection = await getAnalysisJobsCollection();
  if (collection) {
    await collection.updateOne(
      { _id: jobId, status: { $in: ['queued', 'failed'] } },
      { $set: { status: 'processing', progress: 10, startedAt: now, updatedAt: now } },
    );
    return;
  }

  const job = inMemoryJobs.get(jobId);
  if (!job) return;
  if (job.status !== 'queued' && job.status !== 'failed') return;
  job.status = 'processing';
  job.progress = 10;
  job.startedAt = now;
  job.updatedAt = now;
}

/**
 * Devolve o job ao estado `queued` depois de o worker reenfileirá-lo por saturação da Groq.
 *
 * Sem isso o job fica em `processing` para sempre: `markAnalysisJobProcessing` só aceita
 * `queued`/`failed`, então a próxima tentativa rodaria com o registro travado no estado anterior.
 * O usuário vê "na fila", que é a verdade — não houve erro, só falta vaga.
 */
export async function markAnalysisJobQueuedForRetry(jobId: string): Promise<void> {
  const now = new Date();
  const collection = await getAnalysisJobsCollection();

  if (collection) {
    await collection.updateOne(
      { _id: jobId },
      {
        $set: { status: 'queued', progress: 5, startedAt: null, updatedAt: now },
        $unset: { errorCode: '', errorMessage: '' },
      },
    );
    return;
  }

  const job = inMemoryJobs.get(jobId);
  if (!job) return;
  job.status = 'queued';
  job.progress = 5;
  job.startedAt = null;
  job.updatedAt = now;
  delete job.errorCode;
  delete job.errorMessage;
}

export async function completeAnalysisJob(input: {
  jobId: string;
  result: AnalysisJobResult;
}): Promise<void> {
  const now = new Date();
  const status = input.result.status as AnalysisJobStatus;
  const collection = await getAnalysisJobsCollection();

  if (collection) {
    await collection.updateOne(
      { _id: input.jobId },
      {
        $set: {
          status,
          progress: 100,
          result: input.result,
          errorCode: input.result.errorCode,
          completedAt: now,
          updatedAt: now,
        },
      },
    );
    return;
  }

  const job = inMemoryJobs.get(input.jobId);
  if (!job) return;
  job.status = status;
  job.progress = 100;
  job.result = input.result;
  job.errorCode = input.result.errorCode;
  job.completedAt = now;
  job.updatedAt = now;
}

export async function failAnalysisJob(input: {
  jobId: string;
  errorCode?: string;
  errorMessage: string;
}): Promise<void> {
  const now = new Date();
  const collection = await getAnalysisJobsCollection();

  if (collection) {
    await collection.updateOne(
      { _id: input.jobId },
      {
        $set: {
          status: 'failed',
          progress: 100,
          errorCode: input.errorCode ?? 'ANALYSIS_FAILED',
          errorMessage: input.errorMessage,
          completedAt: now,
          updatedAt: now,
        },
      },
    );
    return;
  }

  const job = inMemoryJobs.get(input.jobId);
  if (!job) return;
  job.status = 'failed';
  job.progress = 100;
  job.errorCode = input.errorCode ?? 'ANALYSIS_FAILED';
  job.errorMessage = input.errorMessage;
  job.completedAt = now;
  job.updatedAt = now;
}

export async function loadAnalysisJobPayload(jobId: string): Promise<AnalysisQueueJobPayload | null> {
  const collection = await getAnalysisJobsCollection();
  const job = collection
    ? await collection.findOne({ _id: jobId })
    : inMemoryJobs.get(jobId) ?? null;

  if (!job) return null;

  return {
    jobId: job._id,
    tenantId: job.tenantId,
    ownerUserId: job.ownerUserId,
    originalFileName: job.originalFileName,
    mimeType: job.mimeType,
    fileHash: job.fileHash,
    fileSizeBytes: job.fileSizeBytes,
    stagingKey: job.stagingKey,
    requestId: job.requestId,
    batchId: job.batchId,
    itemId: job.itemId,
    jobKind: job.jobKind,
    documentId: job.documentId,
    membershipId: job.membershipId,
  };
}

export async function assertAnalysisJobAccess(input: {
  jobId: string;
  tenantId: string;
  ownerUserId: string;
}): Promise<MongoAnalysisJob> {
  const collection = await getAnalysisJobsCollection();
  const job = collection
    ? await collection.findOne({
        _id: input.jobId,
        tenantId: input.tenantId,
        ownerUserId: input.ownerUserId,
      })
    : inMemoryJobs.get(input.jobId) ?? null;

  if (!job) {
    throw new ServiceError('Job de análise não encontrado.', 'ANALYSIS_JOB_NOT_FOUND', 404);
  }

  return job;
}
