import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Collection } from 'mongodb';
import { embedChunksMatching } from '../server/services/documentChunkEmbeddingService.js';
import type { MongoDocumentChunk } from '../server/db/types.js';

type FakeChunk = Pick<MongoDocumentChunk, '_id' | 'text'> & {
  tenantId?: string;
  embedding?: number[] | null;
};

/**
 * Coleção em memória com o mínimo que o serviço usa: `find().sort().limit().toArray()` e
 * `bulkWrite`. O objetivo é provar a paginação e o recorte de pendentes sem Mongo e sem
 * carregar o modelo ONNX.
 */
function fakeCollection(docs: FakeChunk[]) {
  const calls: { pageSizes: number[] } = { pageSizes: [] };

  const matches = (doc: FakeChunk, filter: Record<string, unknown>): boolean =>
    Object.entries(filter).every(([key, expected]) => {
      const actual =
        key === '_id' ? doc._id : key === 'embedding' ? (doc.embedding ?? null) : doc[key as 'tenantId'];
      if (expected !== null && typeof expected === 'object' && '$gt' in (expected as object)) {
        return String(actual) > String((expected as { $gt: string }).$gt);
      }
      return actual === expected;
    });

  const collection = {
    find(filter: Record<string, unknown>) {
      const found = docs.filter((doc) => matches(doc, filter));
      return {
        sort() {
          return this;
        },
        limit(count: number) {
          found.length = Math.min(found.length, count);
          return this;
        },
        async toArray() {
          calls.pageSizes.push(found.length);
          return found.map((doc) => ({ _id: doc._id, text: doc.text }));
        },
      };
    },
    async bulkWrite(
      operations: Array<{ updateOne: { filter: { _id: string }; update: { $set: FakeChunk } } }>,
    ) {
      for (const operation of operations) {
        const target = docs.find((doc) => doc._id === operation.updateOne.filter._id);
        if (target) Object.assign(target, operation.updateOne.update.$set);
      }
    },
  };

  return { collection: collection as unknown as Collection<MongoDocumentChunk>, docs, calls };
}

const vectorFor = (text: string): number[] => [text.length, 0, 0];
const fakeEmbedder = async (texts: string[]) => texts.map(vectorFor);

function chunk(id: string, text: string, extra: Partial<FakeChunk> = {}): FakeChunk {
  return { _id: id, text, embedding: null, ...extra };
}

describe('embedChunksMatching', () => {
  it('vetoriza só quem está pendente e preserva quem já tem vetor', async () => {
    const already = [9, 9, 9];
    const { collection, docs } = fakeCollection([
      chunk('chunk_a', 'contrato'),
      chunk('chunk_b', 'nota fiscal', { embedding: already }),
      chunk('chunk_c', 'aditivo'),
    ]);

    const result = await embedChunksMatching(collection, {}, { embedder: fakeEmbedder });

    assert.equal(result.embedded, 2);
    assert.deepEqual(docs.find((d) => d._id === 'chunk_a')?.embedding, vectorFor('contrato'));
    assert.deepEqual(docs.find((d) => d._id === 'chunk_c')?.embedding, vectorFor('aditivo'));
    assert.deepEqual(docs.find((d) => d._id === 'chunk_b')?.embedding, already);
  });

  it('trata campo ausente como pendente', async () => {
    const { collection, docs } = fakeCollection([{ _id: 'chunk_a', text: 'sem campo' }]);

    const result = await embedChunksMatching(collection, {}, { embedder: fakeEmbedder });

    assert.equal(result.embedded, 1);
    assert.deepEqual(docs[0].embedding, vectorFor('sem campo'));
  });

  it('pagina por _id sem repetir chunk entre lotes', async () => {
    const seen: string[] = [];
    const { collection } = fakeCollection([
      chunk('chunk_1', 'um'),
      chunk('chunk_2', 'dois'),
      chunk('chunk_3', 'tres'),
      chunk('chunk_4', 'quatro'),
      chunk('chunk_5', 'cinco'),
    ]);

    const result = await embedChunksMatching(
      collection,
      {},
      {
        batchSize: 2,
        embedder: async (texts) => {
          seen.push(...texts);
          return texts.map(vectorFor);
        },
      },
    );

    assert.equal(result.batches, 3);
    assert.equal(result.embedded, 5);
    assert.deepEqual(seen, ['um', 'dois', 'tres', 'quatro', 'cinco']);
    assert.equal(new Set(seen).size, seen.length);
  });

  it('respeita o filtro recebido e o teto de limit', async () => {
    const { collection, docs } = fakeCollection([
      chunk('chunk_1', 'do tenant a', { tenantId: 'tenant_a' }),
      chunk('chunk_2', 'do tenant b', { tenantId: 'tenant_b' }),
      chunk('chunk_3', 'outro do tenant a', { tenantId: 'tenant_a' }),
    ]);

    const result = await embedChunksMatching(
      collection,
      { tenantId: 'tenant_a' },
      { limit: 1, embedder: fakeEmbedder },
    );

    assert.equal(result.embedded, 1);
    assert.deepEqual(docs.find((d) => d._id === 'chunk_1')?.embedding, vectorFor('do tenant a'));
    assert.equal(docs.find((d) => d._id === 'chunk_2')?.embedding, null);
    assert.equal(docs.find((d) => d._id === 'chunk_3')?.embedding, null);
  });

  it('não manda chunk vazio ao modelo — vetor de prefixo puro atrai qualquer pergunta', async () => {
    const { collection, docs } = fakeCollection([chunk('chunk_1', '   '), chunk('chunk_2', 'real')]);
    const seen: string[] = [];

    const result = await embedChunksMatching(
      collection,
      {},
      {
        batchSize: 1,
        embedder: async (texts) => {
          seen.push(...texts);
          return texts.map(vectorFor);
        },
      },
    );

    assert.deepEqual(seen, ['real']);
    assert.equal(result.scanned, 2);
    assert.equal(result.embedded, 1);
    assert.equal(docs.find((d) => d._id === 'chunk_1')?.embedding, null);
  });

  it('falha alto quando o modelo devolve menos vetores que chunks', async () => {
    const { collection } = fakeCollection([chunk('chunk_1', 'um'), chunk('chunk_2', 'dois')]);

    await assert.rejects(
      embedChunksMatching(collection, {}, { embedder: async () => [[1, 2, 3]] }),
      /2 chunks/,
    );
  });
});
