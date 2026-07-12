import { AI_ERROR_MESSAGES } from '../constants.js';
import type { AnalyzePdfResponse, ClassificationResult } from '../types/documentAi.types.js';
import type { ExtractedDocumentText } from './documentTextExtractor.js';
import type { ProcessingLogItem } from '../types/documentAi.types.js';

export function isVisionOcrFailure(extracted: ExtractedDocumentText): boolean {
  return extracted.ocrErrorCode === 'VISION_OCR_FAILED';
}

/**
 * B.8: falha do Vision → requires_review com metadados mínimos (não 500/422).
 */
export function buildVisionOcrFailedReviewResponse(input: {
  jobId: string;
  originalFileName: string;
  fileHash: string;
  fileSizeBytes: number;
  extracted: ExtractedDocumentText;
  logs: ProcessingLogItem[];
}): AnalyzePdfResponse {
  const reason = AI_ERROR_MESSAGES.visionOcrFailed;
  const classification: ClassificationResult = {
    classId: null,
    className: null,
    confidence: 0,
    requiresReview: true,
    reason,
    evidence: [],
  };

  return {
    jobId: input.jobId,
    status: 'requires_review',
    errorCode: 'VISION_OCR_FAILED',
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
        title: 'Revisão necessária',
        description: reason,
        status: 'done',
      },
    ],
  };
}
