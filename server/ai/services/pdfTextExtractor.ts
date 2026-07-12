import { PDFParse } from 'pdf-parse';
import type { ExtractedPdfText, PdfPageText } from '../types/documentAi.types.js';
import {
  getPdfAnalysisMaxInputChars,
  getPdfAnalysisMaxPages,
} from '../utils/aiConfig.js';
import { normalizeDocumentText } from '../utils/textNormalization.js';
import { logger } from '../../utils/logger.js';
import {
  bufferMeta,
  pipelineDebug,
  pipelineError,
  pipelineInfo,
  previewText,
} from '../utils/pipelineDebug.js';

function truncatePages(pages: PdfPageText[]): { pages: PdfPageText[]; text: string; truncated: boolean } {
  const maxChars = getPdfAnalysisMaxInputChars();
  let totalChars = 0;
  const result: PdfPageText[] = [];
  let truncated = false;

  for (const page of pages) {
    const remaining = maxChars - totalChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    if (page.text.length <= remaining) {
      result.push(page);
      totalChars += page.text.length;
      continue;
    }

    result.push({
      pageNumber: page.pageNumber,
      text: page.text.slice(0, remaining),
    });
    totalChars += remaining;
    truncated = true;
    break;
  }

  const text = result.map((p) => p.text).join('\n\n');
  return { pages: result, text, truncated };
}

function limitPages(pages: PdfPageText[]): { pages: PdfPageText[]; pagesTruncated: boolean } {
  const maxPages = getPdfAnalysisMaxPages();
  if (pages.length <= maxPages) {
    return { pages, pagesTruncated: false };
  }
  return { pages: pages.slice(0, maxPages), pagesTruncated: true };
}

export async function extractTextFromPdf(fileBuffer: Buffer): Promise<ExtractedPdfText> {
  const startedAt = Date.now();
  pipelineInfo('pdfParse', 'inicio parse PDF', {
    ...bufferMeta(fileBuffer, 'pdf'),
    maxInputChars: getPdfAnalysisMaxInputChars(),
    maxPages: getPdfAnalysisMaxPages(),
  });

  const parser = new PDFParse({ data: fileBuffer });

  try {
    const textResult = await parser.getText();

    pipelineDebug('pdfParse', 'PDFParse.getText raw', {
      totalPages: textResult.total,
      rawTextChars: (textResult.text ?? '').length,
      pagesFromParser: textResult.pages?.length ?? 0,
      rawTextPreview: previewText(textResult.text, 160),
    });

    const pages: PdfPageText[] =
      textResult.pages?.length > 0
        ? textResult.pages.map((page) => ({
            pageNumber: page.num,
            text: normalizeDocumentText(page.text ?? ''),
          }))
        : [
            {
              pageNumber: 1,
              text: normalizeDocumentText(textResult.text ?? ''),
            },
          ];

    const nonEmptyPages = pages.filter((page) => page.text.length > 0);
    const sourcePages = nonEmptyPages.length > 0 ? nonEmptyPages : pages;
    const { pages: limitedPages, pagesTruncated } = limitPages(sourcePages);
    const { pages: finalPages, text, truncated } = truncatePages(limitedPages);
    const textTruncated = truncated || pagesTruncated;

    if (textTruncated) {
      logger.info('pdf text extraction truncated for cost guardrails', {
        inputPages: sourcePages.length,
        outputPages: finalPages.length,
        charCount: text.length,
        maxInputChars: getPdfAnalysisMaxInputChars(),
        maxPages: getPdfAnalysisMaxPages(),
        pagesTruncated,
        charsTruncated: truncated,
      });
    }

    pipelineInfo('pdfParse', 'parse PDF concluído', {
      durationMs: Date.now() - startedAt,
      pageCount: textResult.total || finalPages.length,
      charCount: text.length,
      truncated: textTruncated,
      emptySource: nonEmptyPages.length === 0,
      pagesKept: finalPages.length,
      perPageChars: finalPages.map((p) => ({ page: p.pageNumber, chars: p.text.length })),
    });

    return {
      text,
      pages: finalPages,
      pageCount: textResult.total || finalPages.length,
      charCount: text.length,
      truncated: textTruncated,
    };
  } catch (error) {
    pipelineError('pdfParse', 'parse PDF falhou', error, {
      durationMs: Date.now() - startedAt,
      ...bufferMeta(fileBuffer, 'pdf'),
    });
    throw error;
  } finally {
    await parser.destroy();
  }
}
