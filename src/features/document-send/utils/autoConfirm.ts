import { MIN_CLASSIFICATION_CONFIDENCE } from '../uploadConstants';
import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';

export function canAutoConfirm(params: {
  autoMode: boolean;
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
  autoPaused: boolean;
  useAiNaming?: boolean;
}): boolean {
  if (!params.autoMode || !params.isAuthenticated || params.autoPaused) {
    return false;
  }

  const { metadata, rawAnalysis } = params;
  if (!metadata || !rawAnalysis) return false;
  if (metadata.savedDocumentId) return false;

  if (metadata.analysisStatus !== 'completed') return false;
  if (rawAnalysis.status !== 'completed') return false;
  if (rawAnalysis.classification.requiresReview) return false;
  if (rawAnalysis.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) return false;
  if (!rawAnalysis.classification.classId) return false;
  if (params.useAiNaming !== false && !rawAnalysis.recommendedFileName?.trim()) return false;
  if (params.useAiNaming === false && !rawAnalysis.originalFileName?.trim()) return false;
  if (!rawAnalysis.extraction) return false;
  if (rawAnalysis.extraction.requiresReview) return false;

  const missingFields = rawAnalysis.extraction.missingFields ?? metadata.missingFields ?? [];
  if (missingFields.length > 0) return false;

  return true;
}
