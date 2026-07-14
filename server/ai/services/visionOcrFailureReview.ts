import { AI_ERROR_MESSAGES } from '../constants.js';
import type { AnalyzePdfResponse, ClassificationResult } from '../types/documentAi.types.js';
import type { ExtractedDocumentText } from './documentTextExtractor.js';
import type { ProcessingLogItem } from '../types/documentAi.types.js';
import { getVisionOcrMinTextChars } from '../vision/visionConfig.js';

export function isVisionOcrFailure(extracted: ExtractedDocumentText): boolean {
  return extracted.ocrErrorCode === 'VISION_OCR_FAILED';
}

/** OCR tentado (ou falhou) e texto ainda abaixo do mínimo — não dá para seguir a Groq. */
export function isInsufficientTextAfterOcr(extracted: ExtractedDocumentText): boolean {
  if (extracted.charCount >= getVisionOcrMinTextChars()) return false;
  return isVisionOcrFailure(extracted) || extracted.ocrAttempted === true;
}

/**
 * Extração de texto irrecuperável → status failed (não 500/422), com código claro.
 * Evita beco sem saída de requires_review sem classId.
 */
export function buildTextExtractionFailedResponse(input: {
  jobId: string;
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  extracted: ExtractedDocumentText;
  logs: ProcessingLogItem[];
  errorCode: 'VISION_OCR_FAILED' | 'INSUFFICIENT_TEXT';
  reason: string;
}): AnalyzePdfResponse {
  const classification: ClassificationResult = {
    classId: null,
    className: null,
    confidence: 0,
    requiresReview: false,
    reason: input.reason,
    errorCode: input.errorCode,
    evidence: [],
  };

  return {
    jobId: input.jobId,
    status: 'failed',
    errorCode: input.errorCode,
    originalFileName: input.originalFileName,
    fileHash: input.fileHash,
    fileSizeBytes: input.fileSizeBytes,
    recommendedFileName: null,
    textExtraction: {
      status: input.extracted.charCount > 0 ? 'completed' : 'failed',
      pageCount: input.extracted.pageCount,
      charCount: input.extracted.charCount,
      truncated: input.extracted.truncated,
      source: input.extracted.source,
      ocrFallbackUsed: input.extracted.ocrFallbackUsed,
      ocrPagesProcessed: input.extracted.ocrPagesProcessed,
      ocrDurationMs: input.extracted.ocrDurationMs,
    },
    classification,
    extraction: null,
    logs: [
      ...input.logs,
      {
        title: input.errorCode === 'VISION_OCR_FAILED' ? 'OCR falhou' : 'Texto insuficiente',
        description: input.reason,
        status: 'error',
      },
    ],
  };
}

/** @deprecated use buildTextExtractionFailedResponse */
export function buildVisionOcrFailedReviewResponse(input: {
  jobId: string;
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  extracted: ExtractedDocumentText;
  logs: ProcessingLogItem[];
}): AnalyzePdfResponse {
  return buildTextExtractionFailedResponse({
    ...input,
    errorCode: 'VISION_OCR_FAILED',
    reason: AI_ERROR_MESSAGES.visionOcrFailed,
  });
}
