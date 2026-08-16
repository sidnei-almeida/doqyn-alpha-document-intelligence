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

  return toPollResponse(job);
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
