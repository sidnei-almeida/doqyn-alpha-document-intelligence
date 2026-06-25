import { CHUNK_OVERLAP, CHUNK_SIZE } from '../constants.js';
import type { DocumentChunk, ExtractedPdfText } from '../types/documentAi.types.js';
import { normalizeDocumentText } from '../utils/textNormalization.js';

function splitPageIntoChunks(
  pageNumber: number,
  pageText: string,
  globalOffset: number,
): { chunks: DocumentChunk[]; nextOffset: number } {
  const chunks: DocumentChunk[] = [];

  if (pageText.length <= CHUNK_SIZE) {
    chunks.push({
      id: `page_${pageNumber}_chunk_1`,
      pageNumber,
      chunkIndex: 1,
      text: pageText,
      charStart: globalOffset,
      charEnd: globalOffset + pageText.length,
    });
    return { chunks, nextOffset: globalOffset + pageText.length };
  }

  let start = 0;
  let chunkIndex = 1;

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

    if (end >= pageText.length) break;

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
    chunkIndex += 1;
  }

  return { chunks, nextOffset: globalOffset + pageText.length };
}

export function createDocumentChunks(input: ExtractedPdfText): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let globalOffset = 0;

  for (const page of input.pages) {
    const pageText = normalizeDocumentText(page.text);
    if (!pageText) continue;

    const result = splitPageIntoChunks(page.pageNumber, pageText, globalOffset);
    chunks.push(...result.chunks);
    globalOffset = result.nextOffset;
  }

  if (chunks.length === 0 && input.text) {
    const normalized = normalizeDocumentText(input.text);
    const result = splitPageIntoChunks(1, normalized, 0);
    return result.chunks;
  }

  return chunks;
}
