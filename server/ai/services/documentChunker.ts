import { CHUNK_OVERLAP, CHUNK_SIZE } from '../constants.js';
import type { DocumentChunk, ExtractedPdfText } from '../types/documentAi.types.js';
import { normalizeDocumentText } from '../utils/textNormalization.js';

/**
 * `chunkIndex` é sequencial no documento inteiro, não dentro da página.
 *
 * A contagem reiniciava a cada página, e aí a página 2 produzia de novo o trecho 1. Isso viola o
 * índice único `{tenantId, documentId, versionId, chunkIndex}` (`server/db/tenantIndexes.ts`): o
 * `insertMany` morria com E11000 no primeiro repetido, gravava só os trechos anteriores e o resto
 * do documento sumia — sem erro para quem enviou, porque a persistência de chunk é intencionalmente
 * tolerante a falha. Todo documento de mais de uma página ficava com o RAG pela metade.
 *
 * Também conserta a ordenação: `queryDocumentChunksForRag` ordena por `chunkIndex`, o que só faz
 * sentido com contagem global.
 */
function splitPageIntoChunks(
  pageNumber: number,
  pageText: string,
  globalOffset: number,
  firstChunkIndex: number,
): { chunks: DocumentChunk[]; nextOffset: number; nextChunkIndex: number } {
  const chunks: DocumentChunk[] = [];

  if (pageText.length <= CHUNK_SIZE) {
    chunks.push({
      id: `page_${pageNumber}_chunk_${firstChunkIndex}`,
      pageNumber,
      chunkIndex: firstChunkIndex,
      text: pageText,
      charStart: globalOffset,
      charEnd: globalOffset + pageText.length,
    });
    return {
      chunks,
      nextOffset: globalOffset + pageText.length,
      nextChunkIndex: firstChunkIndex + 1,
    };
  }

  let start = 0;
  let chunkIndex = firstChunkIndex;

  while (start < pageText.length) {
    const end = Math.min(start + CHUNK_SIZE, pageText.length);
    const chunkText = pageText.slice(start, end);

    chunks.push({
      id: `page_${pageNumber}_chunk_${chunkIndex}`,
      pageNumber,
      chunkIndex,
      text: chunkText,
      charStart: globalOffset + start,
      charEnd: globalOffset + end,
    });

    chunkIndex += 1;

    if (end >= pageText.length) break;

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return { chunks, nextOffset: globalOffset + pageText.length, nextChunkIndex: chunkIndex };
}

export function createDocumentChunks(input: ExtractedPdfText): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let globalOffset = 0;
  let chunkIndex = 1;

  for (const page of input.pages) {
    const pageText = normalizeDocumentText(page.text);
    if (!pageText) continue;

    const result = splitPageIntoChunks(page.pageNumber, pageText, globalOffset, chunkIndex);
    chunks.push(...result.chunks);
    globalOffset = result.nextOffset;
    chunkIndex = result.nextChunkIndex;
  }

  if (chunks.length === 0 && input.text) {
    const normalized = normalizeDocumentText(input.text);
    const result = splitPageIntoChunks(1, normalized, 0, 1);
    return result.chunks;
  }

  return chunks;
}
