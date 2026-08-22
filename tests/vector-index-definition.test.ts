import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDocumentChunksVectorIndex,
  getVectorIndexCollectionName,
  getVectorIndexFilterPaths,
} from '../server/db/vectorIndexes.js';
import {
  EMBEDDING_DIMENSIONS,
  VECTOR_INDEX_NAME,
} from '../server/ai/embeddings/embeddingConfig.js';

describe('índice vetorial de document_chunks', () => {
  it('declara tenantId e ownerUserId como filtro', () => {
    // `$vectorSearch` não respeita `$match` posterior: sem estes campos declarados no
    // índice, a busca de um tenant devolve trecho de documento de outro. Campo de filtro
    // não pode ser acrescentado depois — só recriando o índice.
    const filters = getVectorIndexFilterPaths();
    assert.ok(filters.includes('tenantId'), 'tenantId ausente dos campos de filtro');
    assert.ok(filters.includes('ownerUserId'), 'ownerUserId ausente dos campos de filtro');
  });

  it('permite recortar por documento e por versão atual', () => {
    const filters = getVectorIndexFilterPaths();
    assert.ok(filters.includes('documentId'));
    assert.ok(filters.includes('isCurrentVersion'));
  });

  it('casa dimensão e nome com a configuração do modelo', () => {
    const spec = buildDocumentChunksVectorIndex();
    assert.equal(spec.name, VECTOR_INDEX_NAME);
    assert.equal(spec.type, 'vectorSearch');

    const vectorField = spec.definition.fields.find((field) => field.type === 'vector');
    assert.ok(vectorField, 'campo de vetor ausente');
    assert.equal(vectorField.path, 'embedding');
    assert.equal(vectorField.numDimensions, EMBEDDING_DIMENSIONS);
    assert.equal(vectorField.similarity, 'cosine');
  });

  it('aponta para a coleção compartilhada de chunks', () => {
    assert.equal(getVectorIndexCollectionName(), 'document_chunks');
  });
});
