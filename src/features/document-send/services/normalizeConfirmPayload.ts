import type { AnalyzePdfResponse } from './analyzePdf';

/**
 * Estrutura mínima aceita por confirmAnalysisSchema quando a IA retorna
 * requires_review antes da extração de metadados (extraction: null).
 */
export function normalizeAnalyzePayloadForConfirm(
  payload: AnalyzePdfResponse,
): AnalyzePdfResponse {
  if (payload.extraction) {
    return payload;
  }

  const reviewReasons = payload.classification.reviewReason
    ? [payload.classification.reviewReason]
    : [];

  return {
    ...payload,
    extraction: {
      documentType: payload.classification.className,
      version: 'v1.0',
      metadata: {},
      missingFields: [],
      requiresReview:
        payload.status === 'requires_review' || payload.classification.requiresReview,
      reviewReasons,
    },
  };
}

/** Valida se a análise pode ser confirmada antes de chamar o backend. */
export function validateConfirmableAnalysis(payload: AnalyzePdfResponse): string | null {
  if (!payload.jobId?.trim()) {
    return 'Identificador da análise ausente. Refaça o upload do documento.';
  }

  if (!payload.classification.classId) {
    return 'Classificação ausente. Não é possível salvar sem uma categoria identificada pela IA.';
  }

  return null;
}
