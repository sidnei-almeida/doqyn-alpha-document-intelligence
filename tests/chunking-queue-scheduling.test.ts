import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scheduleChunkPersistenceAfterVersionConfirm,
  type VersionChunkPersistenceInput,
} from '../server/services/confirmVersionChunkPersistence.js';
import { buildChunkingJobId, type ChunkingQueueJobPayload } from '../server/queues/chunkingQueue.js';
import type { DocumentRequestContext } from '../server/tenancy/documentRequestContext.js';

function buildInput(
  overrides: Partial<VersionChunkPersistenceInput> = {},
): VersionChunkPersistenceInput {
  const ctx = {
    tenantId: 'tenant_1',
    userId: 'user_1',
    membershipId: 'mem_1',
  } as DocumentRequestContext;

  return {
    ctx,
    pdfBuffer: Buffer.from('%PDF-1.7'),
    documentId: 'doc_1',
    versionId: 'ver_1',
    versionLabel: 'v1.0',
    categoryId: 'cat_1',
    createdBy: 'user_1',
    mimeType: 'application/pdf',
    ...overrides,
  };
}

describe('agendamento do fatiamento na confirmação', () => {
  it('enfileira e não fatia dentro do request', async () => {
    const enqueued: ChunkingQueueJobPayload[] = [];
    let inlineCalls = 0;

    const result = await scheduleChunkPersistenceAfterVersionConfirm(buildInput(), {
      enqueue: async (payload) => {
        enqueued.push(payload);
        return true;
      },
      persistInline: async () => void inlineCalls++,
    });

    assert.equal(result.mode, 'queued');
    assert.equal(inlineCalls, 0);
    assert.equal(enqueued.length, 1);
    assert.deepEqual(
      {
        tenantId: enqueued[0].tenantId,
        documentId: enqueued[0].documentId,
        versionId: enqueued[0].versionId,
        versionLabel: enqueued[0].versionLabel,
        categoryId: enqueued[0].categoryId,
        createdBy: enqueued[0].createdBy,
        isCurrentVersion: enqueued[0].isCurrentVersion,
        mimeType: enqueued[0].mimeType,
        userId: enqueued[0].userId,
        membershipId: enqueued[0].membershipId,
      },
      {
        tenantId: 'tenant_1',
        documentId: 'doc_1',
        versionId: 'ver_1',
        versionLabel: 'v1.0',
        categoryId: 'cat_1',
        createdBy: 'user_1',
        isCurrentVersion: true,
        mimeType: 'application/pdf',
        userId: 'user_1',
        membershipId: 'mem_1',
      },
    );
  });

  it('sem fila, fatia inline — trecho não pode esperar backfill que não existe', async () => {
    const inlineInputs: VersionChunkPersistenceInput[] = [];

    const result = await scheduleChunkPersistenceAfterVersionConfirm(buildInput(), {
      enqueue: async () => false,
      persistInline: async (input) => void inlineInputs.push(input),
    });

    assert.equal(result.mode, 'inline');
    assert.equal(inlineInputs.length, 1);
    assert.equal(inlineInputs[0].documentId, 'doc_1');
  });

  it('falha ao enfileirar cai para inline em vez de derrubar a confirmação', async () => {
    let inlineCalls = 0;

    const result = await scheduleChunkPersistenceAfterVersionConfirm(buildInput(), {
      enqueue: async () => {
        throw new Error('Redis fora do ar');
      },
      persistInline: async () => void inlineCalls++,
    });

    assert.equal(result.mode, 'inline');
    assert.equal(inlineCalls, 1);
  });

  it('identidade do job é documento + versão: reconfirmar não fatia duas vezes', () => {
    const payload = {
      tenantId: 'tenant_1',
      documentId: 'doc_1',
      versionId: 'ver_1',
      versionLabel: 'v1.0',
      categoryId: 'cat_1',
      createdBy: 'user_1',
      isCurrentVersion: true,
    } satisfies ChunkingQueueJobPayload;

    assert.equal(buildChunkingJobId(payload), 'chunk_doc_1_ver_1');
    assert.equal(
      buildChunkingJobId({ ...payload, versionLabel: 'v2.0' }),
      buildChunkingJobId(payload),
    );
  });
});
