import { logger } from '../../utils/logger.js';
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
import { recordVisionOcrRequest } from '../../metrics/prometheus.js';
import {
  getVisionOcrHealth,
  getVisionOcrMaxPages,
  getVisionOcrMinTextChars,
  isVisionOcrConfigured,
  isVisionOcrEnabled,
} from '../vision/visionConfig.js';
import { ocrPdfPages } from '../vision/visionOcrService.js';
import type { VisionOcrResult } from '../vision/visionTypes.js';
import { extractTextFromPdf } from './pdfTextExtractor.js';

export type DocumentTextExtractionSource = 'pdf_parse' | 'google_vision' | 'pdf_parse+google_vision';

export type ExtractedDocumentText = ExtractedPdfText & {
  source: DocumentTextExtractionSource;
  ocrFallbackUsed: boolean;
  ocrAttempted: boolean;
  ocrPagesProcessed?: number;
  ocrDurationMs?: number;
  /** Presente quando o Vision foi tentado e falhou. */
  ocrErrorCode?: 'VISION_OCR_FAILED';
};

export type DocumentTextExtractDeps = {
  extractNative?: (buffer: Buffer) => Promise<ExtractedPdfText>;
  ocrPdf?: (
    buffer: Buffer,
    options?: { pageCountHint?: number; maxPages?: number },
  ) => Promise<VisionOcrResult>;
};

/** Política B.8: Vision só dispara abaixo do threshold e com credenciais. */
export function shouldAttemptVisionOcr(input: {
  charCount: number;
  minChars?: number;
  enabled?: boolean;
  configured?: boolean;
}): boolean {
  const minChars = input.minChars ?? getVisionOcrMinTextChars();
  const enabled = input.enabled ?? isVisionOcrEnabled();
  const configured = input.configured ?? isVisionOcrConfigured();
  return input.charCount < minChars && enabled && configured;
}

export function resolveVisionOcrPageLimit(input?: {
  pageCountHint?: number;
  visionMaxPages?: number;
  pdfAnalysisMaxPages?: number;
}): number {
  const visionMax = input?.visionMaxPages ?? getVisionOcrMaxPages();
  const pdfMax = input?.pdfAnalysisMaxPages ?? getPdfAnalysisMaxPages();
  const hint = input?.pageCountHint && input.pageCountHint > 0 ? input.pageCountHint : visionMax;
  return Math.max(1, Math.min(visionMax, pdfMax, hint));
}

/**
 * Extrai texto de PDF: pdf-parse primeiro; se insuficiente e Vision ligado, OCR.
 */
export async function extractTextFromDocumentPdf(
  fileBuffer: Buffer,
  deps: DocumentTextExtractDeps = {},
): Promise<ExtractedDocumentText> {
  const extractNative = deps.extractNative ?? extractTextFromPdf;
  const runOcr = deps.ocrPdf ?? ocrPdfPages;

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
    native = await extractNative(fileBuffer);
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
    logger.info('ocr_cascade', {
      decision: 'skip_vision_native_sufficient',
      ocrFallbackUsed: false,
      ocrAttempted: false,
      ocrPagesProcessed: 0,
      ocrDurationMs: 0,
      charCount: native.charCount,
      minChars,
      totalDurationMs: Date.now() - startedAt,
    });
    pipelineInfo('textExtract.cascade', 'texto nativo suficiente — Vision NÃO chamado', {
      charCount: native.charCount,
      minChars,
      surplusChars: native.charCount - minChars,
      totalDurationMs: Date.now() - startedAt,
    });
    recordVisionOcrRequest({ status: 'skipped' });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
      ocrAttempted: false,
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
    logger.info('ocr_cascade', {
      decision: 'skip_vision_disabled',
      ocrFallbackUsed: false,
      ocrAttempted: false,
      ocrPagesProcessed: 0,
      ocrDurationMs: 0,
      charCount: native.charCount,
      minChars,
    });
    recordVisionOcrRequest({ status: 'skipped' });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
      ocrAttempted: false,
    };
  }

  if (!isVisionOcrConfigured()) {
    pipelineError(
      'textExtract.cascade',
      'Vision habilitado mas credenciais ausentes',
      undefined,
      { health, charCount: native.charCount },
    );
    logger.info('ocr_cascade', {
      decision: 'skip_vision_not_configured',
      ocrFallbackUsed: false,
      ocrAttempted: false,
      ocrPagesProcessed: 0,
      ocrDurationMs: 0,
      charCount: native.charCount,
      minChars,
    });
    recordVisionOcrRequest({
      status: 'error',
      failureReason: 'not_configured',
    });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
      ocrAttempted: false,
      ocrErrorCode: 'VISION_OCR_FAILED',
    };
  }

  const pageCountHint = Math.max(native.pageCount ?? 1, 1);
  const maxPages = resolveVisionOcrPageLimit({ pageCountHint });

  pipelineInfo('textExtract.visionFallback', 'disparando OCR Vision', {
    nativeCharCount: native.charCount,
    minChars,
    pageCountHint,
    maxPages,
    pdfAnalysisMaxPages: getPdfAnalysisMaxPages(),
    visionMaxPages: getVisionOcrMaxPages(),
  });

  try {
    const ocr = await runOcr(fileBuffer, {
      pageCountHint,
      maxPages,
    });

    const source: DocumentTextExtractionSource =
      native.charCount > 0 ? 'pdf_parse+google_vision' : 'google_vision';

    logger.info('ocr_cascade', {
      decision: 'vision_success',
      ocrFallbackUsed: true,
      ocrAttempted: true,
      ocrPagesProcessed: ocr.pagesProcessed,
      ocrDurationMs: ocr.durationMs,
      ocrCharCount: ocr.charCount,
      nativeCharCount: native.charCount,
      minChars,
      maxPages,
      truncated: ocr.truncated,
      totalDurationMs: Date.now() - startedAt,
    });

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

    recordVisionOcrRequest({
      status: 'success',
      pagesProcessed: ocr.pagesProcessed,
    });

    return {
      text: ocr.text,
      pages: ocr.pages,
      pageCount: ocr.pageCount || pageCountHint,
      charCount: ocr.charCount,
      truncated: ocr.truncated || native.truncated,
      source,
      ocrFallbackUsed: true,
      ocrAttempted: true,
      ocrPagesProcessed: ocr.pagesProcessed,
      ocrDurationMs: ocr.durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    pipelineError('textExtract.visionFallback', 'OCR Vision falhou — fallback pdf-parse', error, {
      nativeCharCount: native.charCount,
      totalDurationMs: durationMs,
    });
    logger.info('ocr_cascade', {
      decision: 'vision_failed',
      ocrFallbackUsed: false,
      ocrAttempted: true,
      ocrPagesProcessed: 0,
      ocrDurationMs: durationMs,
      ocrErrorCode: 'VISION_OCR_FAILED',
      charCount: native.charCount,
      minChars,
      totalDurationMs: durationMs,
    });
    recordVisionOcrRequest({
      status: 'error',
      failureReason: 'api_error',
    });
    pipelineDebug('textExtract.cascade', 'retornando native após falha Vision', {
      charCount: native.charCount,
      willLikelyFailMinChars: native.charCount < minChars,
    });
    return {
      ...native,
      source: 'pdf_parse',
      ocrFallbackUsed: false,
      ocrAttempted: true,
      ocrDurationMs: durationMs,
      ocrErrorCode: 'VISION_OCR_FAILED',
    };
  }
}
