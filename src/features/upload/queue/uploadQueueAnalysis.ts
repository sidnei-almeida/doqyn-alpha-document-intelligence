import type { ExtractedMetadata } from '@/features/document-send/types';
import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';

/** Tempo máximo aguardando analyzePdf antes de marcar erro na fila. */
export const UPLOAD_ANALYZE_TIMEOUT_MS = 180_000;

export function analysisFailureMessage(status: AnalyzePdfResponse['status']): string {
  if (status === 'ai_unavailable') {
    return 'Análise de IA indisponível no momento.';
  }
  return 'A análise do documento falhou.';
}

/** Indica se manualReviewConfirmed deve ser true no confirm-analysis. */
export function needsManualReviewConfirmation(
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
): boolean {
  return (
    metadata.analysisStatus === 'requires_review' ||
    raw.status === 'requires_review' ||
    raw.classification.requiresReview ||
    (raw.extraction?.requiresReview ?? false)
  );
}
