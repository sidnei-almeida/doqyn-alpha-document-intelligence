import type { Document } from 'mongodb';
import { VECTOR_INDEX_NAME } from '../ai/embeddings/embeddingConfig.js';
import { embedQuery } from '../ai/embeddings/embeddingService.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { buildDocumentOwnershipFilter } from '../tenancy/documentOwnership.js';
import type { TenantStorageContext } from '../tenancy/tenantStorage.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type VectorSearchScope = {
  documentId?: string;
  /** `false` inclui versões antigas do documento. O padrão busca só a versão vigente. */
  currentOnly?: boolean;
};

export type VectorSearchTuning = {
  limit?: number;
  /**
   * Quantos vizinhos o Atlas examina antes de cortar em `limit`. Mais candidatos = recall melhor
   * e consulta mais cara. A recomendação do Atlas é da ordem de 10x o limite.
   */
  numCandidates?: number;
  /** Similaridade mínima já normalizada pelo Atlas para (1 + cosseno) / 2, portanto em [0, 1]. */
  minScore?: number;
};

export type VectorSearchHit = {
  chunkId: string;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  score: number;
};

export const DEFAULT_VECTOR_SEARCH_LIMIT = 8;
const CANDIDATES_PER_RESULT = 10;

/**
 * Filtro que vai **dentro** do estágio `$vectorSearch`.
 *
 * Aqui está o isolamento inteiro da busca semântica. `$vectorSearch` não é um `find`: ele
 * percorre o índice e devolve os k vizinhos mais próximos de todo o pool, e um `$match`
 * posterior só consegue descartar o que já foi escolhido — o resultado seria menos linhas de um
 * ranking que já misturou tenants, não o ranking do tenant certo. Por isso `tenantId` entra
 * aqui, e por isso ele é campo de filtro declarado no índice (`server/db/vectorIndexes.ts`).
 *
 * Só campos declarados como `filter` no índice podem aparecer neste estágio — o que explica
 * `tenantId` sozinho onde `buildDocumentOwnershipFilter` usa `$or` com `companyId`: os dois são
 * gravados com o mesmo valor por `applyDocumentOwnershipOnInsert`, e o `$or` existe para linha
 * legada sem `tenantId`, que é justamente a linha que não deve ser visível por ninguém.
 */
export function buildVectorSearchFilter(
  storage: TenantStorageContext,
  scope: VectorSearchScope = {},
): Record<string, unknown> {
  if (!storage.tenantId) {
    throw new ServiceError(
      'tenantId é obrigatório para busca vetorial.',
      'TENANT_SCOPE_REQUIRED',
      400,
    );
  }

  const clauses: Record<string, unknown>[] = [{ tenantId: { $eq: storage.tenantId } }];

  if (storage.storageMode === 'shared_individual_collection') {
    if (!storage.userId) {
      throw new ServiceError(
        'ownerUserId é obrigatório para busca vetorial em storage compartilhado.',
        'OWNER_USER_REQUIRED',
        400,
      );
    }
    clauses.push({ ownerUserId: { $eq: storage.userId } });
  }

  if (scope.documentId) {
    clauses.push({ documentId: { $eq: scope.documentId } });
  }

  if (scope.currentOnly !== false) {
    clauses.push({ isCurrentVersion: { $eq: true } });
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

/**
 * `$match` depois do ranking, com o mesmo filtro canônico do resto do sistema.
 *
 * Não substitui o filtro de dentro do `$vectorSearch` — reconfere. Se um dia o índice for
 * recriado sem `tenantId`, a busca passa a devolver vazio em vez de vazar trecho de outro
 * cliente; falhar fechado é o modo de falha aceitável aqui.
 */
export function buildVectorSearchPostFilter(
  storage: TenantStorageContext,
  scope: VectorSearchScope = {},
  minScore?: number,
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...buildDocumentOwnershipFilter(storage) };

  if (scope.documentId) filter.documentId = scope.documentId;
  if (scope.currentOnly !== false) filter.isCurrentVersion = true;
  if (typeof minScore === 'number') filter.score = { $gte: minScore };

  return filter;
}

export function buildVectorSearchPipeline(input: {
  queryVector: number[];
  storage: TenantStorageContext;
  scope?: VectorSearchScope;
  tuning?: VectorSearchTuning;
}): Document[] {
  const limit = input.tuning?.limit ?? DEFAULT_VECTOR_SEARCH_LIMIT;
  const numCandidates = input.tuning?.numCandidates ?? limit * CANDIDATES_PER_RESULT;

  return [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector: input.queryVector,
        numCandidates,
        limit,
        filter: buildVectorSearchFilter(input.storage, input.scope),
      },
    },
    { $set: { score: { $meta: 'vectorSearchScore' } } },
    { $match: buildVectorSearchPostFilter(input.storage, input.scope, input.tuning?.minScore) },
    {
      $project: {
        _id: 1,
        documentId: 1,
        versionId: 1,
        versionLabel: 1,
        categoryId: 1,
        chunkIndex: 1,
        pageNumber: 1,
        text: 1,
        score: 1,
      },
    },
  ];
}

/**
 * Busca semântica sobre os chunks já vetorizados do tenant.
 *
 * Distinta do retrieval híbrido de `retrievalProvider`: aquele escolhe trechos do documento que
 * está sendo analisado, com os chunks em memória; esta responde pergunta sobre o acervo já
 * gravado. São dois caminhos, não dois modos do mesmo caminho.
 */
export async function searchDocumentChunksByVector(input: {
  ctx: DocumentRequestContext;
  query: string;
  scope?: VectorSearchScope;
  tuning?: VectorSearchTuning;
}): Promise<VectorSearchHit[]> {
  const query = input.query.trim();
  if (!query) {
    throw new ServiceError('A pergunta não pode ser vazia.', 'EMPTY_QUERY', 400);
  }

  const queryVector = await embedQuery(query);
  const pipeline = buildVectorSearchPipeline({
    queryVector,
    storage: input.ctx.storage,
    scope: input.scope,
    tuning: input.tuning,
  });

  const rows = await input.ctx.collections.documentChunks
    .aggregate(pipeline)
    .toArray();

  return rows.map((row) => ({
    chunkId: String(row._id),
    documentId: row.documentId,
    versionId: row.versionId,
    versionLabel: row.versionLabel,
    categoryId: row.categoryId,
    chunkIndex: row.chunkIndex,
    pageNumber: row.pageNumber,
    text: row.text,
    score: row.score,
  }));
}
