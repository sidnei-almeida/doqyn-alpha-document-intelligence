import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isGroqSaturationCode, isGroqSaturationError } from '../server/ai/utils/groqSaturation.js';
import {
  requeueAnalysisJobOnSaturation,
  saturationRetryDelayMs,
  type SaturationRequeueableJob,
} from '../server/workers/analysisSaturationRequeue.js';
import type { AnalysisQueueJobPayload } from '../server/services/analysis/analysisJobTypes.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function buildPayload(overrides: Partial<AnalysisQueueJobPayload> = {}): AnalysisQueueJobPayload {
  return {
    jobId: 'job_test',
    tenantId: 'tenant_1',
    ownerUserId: 'user_1',
    originalFileName: 'contrato.pdf',
    mimeType: 'application/pdf',
    fileHash: 'a'.repeat(64),
    fileSizeBytes: 1024,
    ...overrides,
  };
}

/** Job do BullMQ de mentira: só o que o reenfileiramento toca. */
function fakeJob() {
  const calls = {
    updated: [] as AnalysisQueueJobPayload[],
    delayedAt: [] as number[],
    tokens: [] as (string | undefined)[],
  };

  const job: SaturationRequeueableJob = {
    token: 'token_1',
    async updateData(data) {
      calls.updated.push(data);
    },
    async moveToDelayed(timestamp, token) {
      calls.delayedAt.push(timestamp);
      calls.tokens.push(token);
    },
  };

  return { job, calls };
}

function markQueuedSpy() {
  const jobIds: string[] = [];
  return { jobIds, markJobQueued: async (jobId: string) => void jobIds.push(jobId) };
}

describe('reconhecimento de saturação da Groq', () => {
  it('trata como saturação só o que espera resolve', () => {
    assert.equal(isGroqSaturationCode('GROQ_RATE_LIMIT'), true);
    assert.equal(isGroqSaturationCode('GROQ_LOCAL_RATE_LIMIT'), true);
    // Cota do dia e prompt grande demais não melhoram com espera.
    assert.equal(isGroqSaturationCode('GROQ_DAILY_TOKEN_LIMIT'), false);
    assert.equal(isGroqSaturationCode('GROQ_CONTEXT_LIMIT'), false);
    assert.equal(isGroqSaturationCode(undefined), false);
  });

  it('reconhece o erro pelo código, sem depender da classe', () => {
    const aiError = Object.assign(new Error('IA indisponível'), { code: 'GROQ_RATE_LIMIT' });
    const waitTimeout = Object.assign(new Error('esperou demais'), {
      code: 'GROQ_LOCAL_RATE_LIMIT',
    });

    assert.equal(isGroqSaturationError(aiError), true);
    assert.equal(isGroqSaturationError(waitTimeout), true);
    assert.equal(isGroqSaturationError(new Error('falha genérica')), false);
    assert.equal(isGroqSaturationError(null), false);
  });
});

describe('devolução do job de análise para a fila', () => {
  it('devolve o job para a fila e conta a tentativa no payload', async () => {
    const { job, calls } = fakeJob();
    const spy = markQueuedSpy();
    process.env.ANALYSIS_SATURATION_RETRY_DELAY_MS = '30000';

    const outcome = await requeueAnalysisJobOnSaturation({
      job,
      payload: buildPayload(),
      origin: 'result',
      errorCode: 'GROQ_RATE_LIMIT',
      markJobQueued: spy.markJobQueued,
      now: () => 1_000,
      random: () => 0,
    });

    assert.equal(outcome.requeued, true);
    assert.equal(outcome.attempt, 1);
    // O job Mongo volta a `queued` — senão a próxima tentativa esbarra no estado `processing`.
    assert.deepEqual(spy.jobIds, ['job_test']);
    assert.equal(calls.updated[0]?.saturationRequeues, 1);
    assert.deepEqual(calls.delayedAt, [1_000 + 30_000]);
    assert.deepEqual(calls.tokens, ['token_1']);
  });

  it('recua mais a cada volta', () => {
    process.env.ANALYSIS_SATURATION_RETRY_DELAY_MS = '30000';

    assert.equal(saturationRetryDelayMs(0, () => 0), 30_000);
    assert.equal(saturationRetryDelayMs(1, () => 0), 60_000);
    assert.equal(saturationRetryDelayMs(2, () => 0), 120_000);
    // Teto: mais que isso e o usuário desiste antes de a análise voltar.
    assert.equal(saturationRetryDelayMs(20, () => 0), 300_000);
  });

  it('dispersa as voltas para o lote não bater na parede em bloco', () => {
    process.env.ANALYSIS_SATURATION_RETRY_DELAY_MS = '30000';

    assert.equal(saturationRetryDelayMs(0, () => 0.5), 32_500);
  });

  it('para de devolver depois do teto e deixa o caminho antigo assumir', async () => {
    const { job, calls } = fakeJob();
    const spy = markQueuedSpy();
    process.env.ANALYSIS_SATURATION_MAX_REQUEUES = '2';

    const outcome = await requeueAnalysisJobOnSaturation({
      job,
      payload: buildPayload({ saturationRequeues: 2 }),
      origin: 'result',
      errorCode: 'GROQ_RATE_LIMIT',
      markJobQueued: spy.markJobQueued,
    });

    assert.equal(outcome.requeued, false);
    assert.equal(outcome.attempt, 3);
    assert.deepEqual(spy.jobIds, []);
    assert.deepEqual(calls.delayedAt, []);
  });

  it('teto zero desliga o reenfileiramento', async () => {
    const { job, calls } = fakeJob();
    const spy = markQueuedSpy();
    process.env.ANALYSIS_SATURATION_MAX_REQUEUES = '0';

    const outcome = await requeueAnalysisJobOnSaturation({
      job,
      payload: buildPayload(),
      origin: 'error',
      errorCode: 'GROQ_LOCAL_RATE_LIMIT',
      markJobQueued: spy.markJobQueued,
    });

    assert.equal(outcome.requeued, false);
    assert.deepEqual(calls.updated, []);
    assert.deepEqual(spy.jobIds, []);
  });
});
