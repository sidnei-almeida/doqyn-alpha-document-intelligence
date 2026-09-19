import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_BATCH_DOCUMENT_IDS,
  normalizeBatchDocumentIds,
} from '../server/utils/batchDocumentIds.js';

describe('documentIds de lote', () => {
  it('descarta o que não é id e apara o espaço', () => {
    const ids = normalizeBatchDocumentIds(['doc_1', '  doc_2  ', '', '   ', 7, null, {}]);
    assert.deepEqual(ids, ['doc_1', 'doc_2']);
  });

  it('não é array vira lista vazia', () => {
    assert.deepEqual(normalizeBatchDocumentIds(undefined), []);
    assert.deepEqual(normalizeBatchDocumentIds('doc_1'), []);
  });

  it('id repetido conta uma vez — o mesmo documento não é processado duas vezes', () => {
    assert.deepEqual(normalizeBatchDocumentIds(['doc_1', 'doc_1', ' doc_1 ']), ['doc_1']);
  });

  it('o teto cabe a listagem inteira com folga', () => {
    // A listagem devolve no máximo 100 por página.
    assert.ok(MAX_BATCH_DOCUMENT_IDS >= 100);
  });
});
