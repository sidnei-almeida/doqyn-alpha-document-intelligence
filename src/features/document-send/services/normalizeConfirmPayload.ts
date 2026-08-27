import type { AnalyzePdfResponse } from './analyzePdf';

/**
 * Estrutura mínima aceita por confirmAnalysisSchema quando a IA retorna
 * requires_review antes da extração de metadados (extraction: null).
 */
export function normalizeAnalyzePayloadForConfirm(payload: AnalyzePdfResponse): AnalyzePdfResponse {
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
      requiresReview: payload.status === 'requires_review' || payload.classification.requiresReview,
      reviewReasons,
    },
  };
}

/**
 * Valida se a análise pode ser confirmada antes de chamar o backend.
 *
 * A categoria pode vir de três lugares, e a guarda precisa conhecer os três: a IA, a escolha de
 * quem revisa, e o pedido que o envio cumpre. Exigir só a da IA anulava no cliente exatamente o
 * resgate que o servidor oferece — quem escolhia a categoria à mão na tela de revisão via
 * "Classificação ausente" e o documento ficava parado, com o arquivo já no storage.
 */
export function validateConfirmableAnalysis(
  payload: AnalyzePdfResponse,
  fallback?: { manualClassId?: string; documentRequestId?: string },
): string | null {
  if (!payload.jobId?.trim()) {
    return 'Identificador da análise ausente. Refaça o upload do documento.';
  }

  const hasCategory =
    Boolean(payload.classification.classId) ||
    Boolean(fallback?.manualClassId?.trim()) ||
    // O pedido decide a categoria no servidor, e vence até a escolha de quem envia.
    Boolean(fallback?.documentRequestId?.trim());

  if (!hasCategory) {
    return 'Classificação ausente. Escolha uma categoria para salvar este documento.';
  }

  return null;
}
