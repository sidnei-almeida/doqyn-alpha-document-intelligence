import {
  bufferMeta,
  pipelineDebug,
  pipelineError,
  pipelineInfo,
  pipelineWarn,
  previewText,
} from '../utils/pipelineDebug.js';
import type { ExtractedPdfText } from '../types/documentAi.types.js';
import { getPdfAnalysisMaxPages } from '../utils/aiConfig.js';
import {
  getVisionOcrHealth,
  getVisionOcrMaxPages,
  getVisionOcrMinTextChars,
  isVisionOcrConfigured,
  isVisionOcrEnabled,
} from '../vision/visionConfig.js';
import { ocrPdfPages } from '../vision/visionOcrService.js';
import { extractTextFromPdf } from './pdfTextExtractor.js';

export type DocumentTextExtractionSource = 'pdf_parse' | 'google_vision' | 'pdf_parse+google_vision';

export type ExtractedDocumentText = ExtractedPdfText & {
  source: DocumentTextExtractionSource;
  ocrFallbackUsed: boolean;
  ocrPagesProcessed?: number;
  ocrDurationMs?: number;
};

/**
 * Extrai texto de PDF: pdf-parse primeiro; se insuficiente e Vision ligado, OCR.
 */
export async function extractTextFromDocumentPdf(
  fileBuffer: Buffer,
): Promise<ExtractedDocumentText> {
  const startedAt = Date.now();
  const minChars = getVisionOcrMinTextChars();
  const health = getVisionOcrHealth();

  pipelineInfo('textExtract.cascade', 'inicio cascata pdf-parse → Vision', {
    ...bufferMeta(fileBuffer, 'pdf'),
    minChars,
    visionEnabled: isVisionOcrEnabled(),
    visionConfigured: isVisionOcrConfigured(),
    visionHealth: health,
  });

  let native: ExtractedPdfText;
  try {
    const nativeStarted = Date.now();
    native = await extractTextFromPdf(fileBuffer);
    pipelineInfo('textExtract.pdfParse', 'pdf-parse concluído', {
      durationMs: Date.now() - nativeStarted,
      charCount: native.charCount,
      pageCount: native.pageCount,
      pagesWithText: native.pages.filter((p) => p.text.length > 0).length,
      truncated: native.truncated,
      textPreview: previewText(native.text, 160),
      perPageChars: native.pages.map((p) => ({
        page: p.pageNumber,
        chars: p.text.length,
      })),
    });
  } catch (error) {
    pipelineError('textExtract.pdfParse', 'pdf-parse lançou erro', error, {
      ...bufferMeta(fileBuffer, 'pdf'),
    });
    throw error;
  }

  if (native.charCount >= minChars) {
    pipelineInfo('textExtract.cascade', 'texto nativo suficiente — Vision NÃO chamado', {
      charCount: native.charCount,
      minChars,
      surplusChars: native.charCount - minChars,
      totalDurationMs: Date.now() - startedAt,
    });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
    };
  }

  pipelineWarn('textExtract.cascade', 'texto nativo insuficiente — avaliando Vision', {
    charCount: native.charCount,
    minChars,
    deficitChars: minChars - native.charCount,
    visionEnabled: isVisionOcrEnabled(),
    visionConfigured: isVisionOcrConfigured(),
  });

  if (!isVisionOcrEnabled()) {
    pipelineWarn('textExtract.cascade', 'Vision desabilitado — retornando pdf-parse fraco', {
      charCount: native.charCount,
      minChars,
    });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
    };
  }

  if (!isVisionOcrConfigured()) {
    pipelineError(
      'textExtract.cascade',
      'Vision habilitado mas credenciais ausentes',
      undefined,
      { health, charCount: native.charCount },
    );
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
    };
  }

  const maxPages = Math.min(getVisionOcrMaxPages(), getPdfAnalysisMaxPages());
  const pageCountHint = Math.max(native.pageCount ?? 1, 1);

  pipelineInfo('textExtract.visionFallback', 'disparando OCR Vision', {
    nativeCharCount: native.charCount,
    minChars,
    pageCountHint,
    maxPages,
    pdfAnalysisMaxPages: getPdfAnalysisMaxPages(),
    visionMaxPages: getVisionOcrMaxPages(),
  });

  try {
    const ocr = await ocrPdfPages(fileBuffer, {
      pageCountHint,
      maxPages,
    });

    const source: DocumentTextExtractionSource =
      native.charCount > 0 ? 'pdf_parse+google_vision' : 'google_vision';

    pipelineInfo('textExtract.visionFallback', 'OCR Vision ok — resultado final', {
      source,
      ocrCharCount: ocr.charCount,
      ocrPagesProcessed: ocr.pagesProcessed,
      ocrDurationMs: ocr.durationMs,
      ocrTruncated: ocr.truncated,
      meetsMinChars: ocr.charCount >= minChars,
      totalDurationMs: Date.now() - startedAt,
      textPreview: previewText(ocr.text, 200),
    });

    return {
      text: ocr.text,
      pages: ocr.pages,
      pageCount: ocr.pageCount || pageCountHint,
      charCount: ocr.charCount,
      truncated: ocr.truncated || native.truncated,
      source,
      ocrFallbackUsed: true,
      ocrPagesProcessed: ocr.pagesProcessed,
      ocrDurationMs: ocr.durationMs,
    };
  } catch (error) {
    pipelineError('textExtract.visionFallback', 'OCR Vision falhou — fallback pdf-parse', error, {
      nativeCharCount: native.charCount,
      totalDurationMs: Date.now() - startedAt,
    });
    pipelineDebug('textExtract.cascade', 'retornando native após falha Vision', {
      charCount: native.charCount,
      willLikelyFailMinChars: native.charCount < minChars,
    });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
    };
  }
}
