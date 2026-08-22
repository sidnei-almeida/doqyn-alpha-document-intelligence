import type { Collection, Filter } from 'mongodb';
import { getEmbeddingBatchSize } from '../ai/embeddings/embeddingConfig.js';
import { embedPassages } from '../ai/embeddings/embeddingService.js';
import type { MongoDocumentChunk } from '../db/types.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import { logger } from '../utils/logger.js';

/** Assinatura de `embedPassages`, injetável para teste sem carregar o modelo ONNX. */
export type ChunkEmbedder = (texts: string[]) => Promise<number[][]>;

export type EmbedChunksResult = {
  scanned: number;
  embedded: number;
  batches: number;
  durationMs: number;
};

export type EmbedChunksOptions = {
  /** Teto de chunks processados na chamada. Sem teto, processa até a coleção acabar. */
  limit?: number;
  batchSize?: number;
  embedder?: ChunkEmbedder;
  /** Reprocessa quem já tem vetor. Necessário só ao trocar de modelo. */
  includeEmbedded?: boolean;
};

type ChunkToEmbed = Pick<MongoDocumentChunk, '_id' | 'text'>;

/**
 * `{ embedding: null }` casa tanto com o campo nulo quanto com o campo ausente — os dois
 * significam "nunca vetorizado". Chunk gravado antes do embedding existir cai no segundo caso.
 */
function pendingEmbeddingFilter(includeEmbedded: boolean): Record<string, unknown> {
  return includeEmbedded ? {} : { embedding: null };
}

/**
 * Vetoriza os chunks que casam com `filter` e grava o vetor em cada um.
 *
 * **O recorte de tenant é responsabilidade de quem chama** — este serviço recebe a coleção e o
 * filtro já prontos. No caminho do produto use `embedChunksForDocumentVersion`, que monta o
 * escopo a partir do contexto; o filtro cru existe para o backfill operacional, que roda sobre
 * a base inteira de propósito.
 *
 * A paginação é por `_id` crescente, não por `skip`: o próprio update tira o chunk do filtro
 * de pendentes, então repaginar do zero a cada lote pularia registros ou giraria em falso se um
 * lote falhasse.
 */
export async function embedChunksMatching(
  collection: Collection<MongoDocumentChunk>,
  filter: Record<string, unknown>,
  options: EmbedChunksOptions = {},
): Promise<EmbedChunksResult> {
  const startedAt = Date.now();
  const embedder = options.embedder ?? embedPassages;
  const batchSize = options.batchSize ?? getEmbeddingBatchSize();
  const limit = options.limit;

  let scanned = 0;
  let embedded = 0;
  let batches = 0;
  let cursorId: string | null = null;

  while (limit === undefined || scanned < limit) {
    const remaining = limit === undefined ? batchSize : Math.min(batchSize, limit - scanned);
    if (remaining <= 0) break;

    const pageFilter: Record<string, unknown> = {
      ...filter,
      ...pendingEmbeddingFilter(options.includeEmbedded === true),
    };
    if (cursorId !== null) {
      pageFilter._id = { $gt: cursorId };
    }

    const page = (await collection
      .find(pageFilter as Filter<MongoDocumentChunk>, { projection: { _id: 1, text: 1 } })
      .sort({ _id: 1 })
      .limit(remaining)
      .toArray()) as ChunkToEmbed[];

    if (page.length === 0) break;

    scanned += page.length;
    cursorId = page[page.length - 1]._id;

    // Chunk sem texto não gera vetor útil e ainda faria o modelo devolver o embedding do
    // prefixo `passage:` sozinho, que atrai qualquer pergunta.
    const withText = page.filter((chunk) => chunk.text.trim().length > 0);
    if (withText.length === 0) continue;

    const vectors = await embedder(withText.map((chunk) => chunk.text));
    if (vectors.length !== withText.length) {
      throw new Error(
        `Embedding devolveu ${vectors.length} vetores para ${withText.length} chunks.`,
      );
    }

    await collection.bulkWrite(
      withText.map((chunk, index) => ({
        updateOne: {
          filter: { _id: chunk._id } as Filter<MongoDocumentChunk>,
          update: { $set: { embedding: vectors[index] } },
        },
      })),
    );

    embedded += withText.length;
    batches += 1;
  }

  return { scanned, embedded, batches, durationMs: Date.now() - startedAt };
}

/**
 * Vetoriza os chunks de uma versão de documento dentro do escopo do tenant do contexto.
 *
 * Custa segundos por documento e carrega ~280 MB de modelo no processo — não chame do caminho
 * de request; o lugar dela é o worker.
 */
export async function embedChunksForDocumentVersion(input: {
  ctx: DocumentRequestContext;
  documentId: string;
  versionId: string;
  options?: EmbedChunksOptions;
}): Promise<EmbedChunksResult> {
  const filter: Record<string, unknown> = {
    documentId: input.documentId,
    versionId: input.versionId,
    ...tenantScopeFilterFromContext(input.ctx.storage),
  };

  const result = await embedChunksMatching(
    input.ctx.collections.documentChunks,
    filter,
    input.options,
  );

  logger.info('Chunks vetorizados para versão do documento', {
    documentId: input.documentId,
    versionId: input.versionId,
    ...result,
  });

  return result;
}
