import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDocumentChunks } from '../server/ai/services/documentChunker.js';
import { mapDocumentChunksToMongo } from '../server/services/documentChunkService.js';
import { CHUNK_SIZE } from '../server/ai/constants.js';
import type { ExtractedPdfText } from '../server/ai/types/documentAi.types.js';

function pdfWithPages(pageTexts: string[]): ExtractedPdfText {
  return {
    text: pageTexts.join('\n'),
    charCount: pageTexts.join('\n').length,
    pageCount: pageTexts.length,
    truncated: false,
    source: 'pdf_parse',
    pages: pageTexts.map((text, index) => ({ pageNumber: index + 1, text })),
  } as unknown as ExtractedPdfText;
}

const longPage = (marker: string) => `${marker} `.repeat(Math.ceil((CHUNK_SIZE * 2.5) / 2));

describe('numeração de chunk em documento de várias páginas', () => {
  it('não repete chunkIndex entre páginas', () => {
    const chunks = createDocumentChunks(pdfWithPages(['Página um.', 'Página dois.', 'Página três.']));
    const indexes = chunks.map((chunk) => chunk.chunkIndex);

    assert.equal(chunks.length, 3);
    assert.deepEqual(indexes, [1, 2, 3]);
    assert.equal(new Set(indexes).size, indexes.length);
  });

  it('segue sequencial quando uma página se divide em vários trechos', () => {
    const chunks = createDocumentChunks(pdfWithPages([longPage('alfa'), longPage('beta')]));
    const indexes = chunks.map((chunk) => chunk.chunkIndex);

    assert.ok(chunks.length > 2, 'páginas longas deveriam gerar mais de um trecho cada');
    assert.equal(new Set(indexes).size, indexes.length);
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
    assert.equal(indexes[0], 1);
    assert.equal(indexes[indexes.length - 1], chunks.length);
  });

  it('gera _id único por chunk — o índice único do Mongo é sobre documento+versão+chunkIndex', () => {
    // Com contagem por página, a página 2 repetia o trecho 1, o insertMany morria com E11000 e o
    // documento era gravado pela metade, em silêncio.
    const chunks = createDocumentChunks(pdfWithPages(['Primeira.', 'Segunda.', 'Terceira.']));

    const records = mapDocumentChunksToMongo({
      chunks,
      tenantFields: { tenantId: 'tenant_1', companyId: 'tenant_1' },
      documentId: 'doc_1',
      versionId: 'ver_1',
      versionLabel: 'v1.0',
      categoryId: 'cat_1',
      isCurrentVersion: true,
    });

    const ids = records.map((record) => record._id);
    assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.join(', ')}`);
  });

  it('preserva a página de origem de cada trecho', () => {
    const chunks = createDocumentChunks(pdfWithPages(['Um.', 'Dois.', 'Tres.']));
    assert.deepEqual(
      chunks.map((chunk) => chunk.pageNumber),
      [1, 2, 3],
    );
  });
});
