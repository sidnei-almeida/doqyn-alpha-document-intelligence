import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildEmbeddingJobId,
  getEmbeddingQueueConcurrency,
  isEmbeddingQueueEnabled,
} from '../server/queues/embeddingQueue.js';

const originalEnv = { ...process.env };

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('fila de embedding', () => {
  it('fica desligada sem EMBEDDING_ENABLED, mesmo com Redis configurado', () => {
    setEnv({
      EMBEDDING_ENABLED: undefined,
      REDIS_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379',
    });
    assert.equal(isEmbeddingQueueEnabled(), false);
  });

  it('fica desligada sem Redis — vetorizar no processo do request é o que não pode acontecer', () => {
    setEnv({ EMBEDDING_ENABLED: 'true', REDIS_ENABLED: 'false', REDIS_URL: undefined });
    assert.equal(isEmbeddingQueueEnabled(), false);
  });

  it('liga com as duas pontas configuradas', () => {
    setEnv({
      EMBEDDING_ENABLED: 'true',
      REDIS_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379',
    });
    assert.equal(isEmbeddingQueueEnabled(), true);
  });

  it('jobId é derivado de documento e versão, então reconfirmar não duplica trabalho', () => {
    const payload = { tenantId: 'tenant_a', documentId: 'doc_1', versionId: 'ver_1' };
    assert.equal(buildEmbeddingJobId(payload), 'embed_doc_1_ver_1');
    assert.equal(
      buildEmbeddingJobId({ ...payload, userId: 'user_9' }),
      buildEmbeddingJobId(payload),
    );
    assert.notEqual(
      buildEmbeddingJobId({ ...payload, versionId: 'ver_2' }),
      buildEmbeddingJobId(payload),
    );
  });

  it('concorrência padrão é 1 — inferência é CPU-bound e divide host com a análise', () => {
    setEnv({ EMBEDDING_QUEUE_CONCURRENCY: undefined });
    assert.equal(getEmbeddingQueueConcurrency(), 1);
    setEnv({ EMBEDDING_QUEUE_CONCURRENCY: '3' });
    assert.equal(getEmbeddingQueueConcurrency(), 3);
    setEnv({ EMBEDDING_QUEUE_CONCURRENCY: '0' });
    assert.equal(getEmbeddingQueueConcurrency(), 1);
  });
});
