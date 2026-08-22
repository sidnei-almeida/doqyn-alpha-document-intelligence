import { EMBEDDING_DIMENSIONS, VECTOR_INDEX_NAME } from '../ai/embeddings/embeddingConfig.js';
import { COLLECTIONS } from './constants.js';

export type AtlasSearchIndexSpec = {
  name: string;
  type: 'vectorSearch';
  definition: {
    fields: Array<
      | {
          type: 'vector';
          path: string;
          numDimensions: number;
          similarity: 'cosine' | 'euclidean' | 'dotProduct';
        }
      | { type: 'filter'; path: string }
    >;
  };
};

/**
 * Índice vetorial de `document_chunks`.
 *
 * **Os campos de filtro não são otimização, são isolamento.** `$vectorSearch` não respeita
 * um `$match` posterior: ele varre o índice inteiro e devolve os k vizinhos mais próximos,
 * de todos os tenants. O recorte por tenant só existe se `tenantId` estiver declarado como
 * `filter` aqui dentro e for passado no estágio da consulta. Sem isso, a busca de um cliente
 * devolve trecho de contrato de outro.
 *
 * `ownerUserId` cobre o tenant PF, onde vários usuários dividem a mesma coleção e o recorte
 * por `tenantId` sozinho não basta — mesma regra que `buildDocumentOwnershipFilter` aplica
 * no resto do sistema.
 *
 * Campo de filtro **não pode ser acrescentado depois**: mudar esta lista exige recriar o
 * índice. Por isso `documentId` e `isCurrentVersion` já entram, mesmo antes de existir tela
 * que os use.
 */
export function buildDocumentChunksVectorIndex(): AtlasSearchIndexSpec {
  return {
    name: VECTOR_INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: EMBEDDING_DIMENSIONS,
          similarity: 'cosine',
        },
        { type: 'filter', path: 'tenantId' },
        { type: 'filter', path: 'ownerUserId' },
        { type: 'filter', path: 'documentId' },
        { type: 'filter', path: 'isCurrentVersion' },
      ],
    },
  };
}

export function getVectorIndexCollectionName(): string {
  return COLLECTIONS.documentChunks;
}

/** Campos de filtro declarados, na ordem — usado por teste de regressão. */
export function getVectorIndexFilterPaths(): string[] {
  return buildDocumentChunksVectorIndex()
    .definition.fields.filter((field) => field.type === 'filter')
    .map((field) => field.path);
}
