import type { AnalyzePdfResponse } from './analyzePdf';
import type { CategorySuggestionMode } from '@shared/uploadPolicy';
import { commonPhrase } from '@/i18n/commonPhrase';

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
 * A categoria pode vir de quatro lugares, e a guarda precisa conhecer os quatro: a IA, a escolha
 * de quem revisa, o pedido que o envio cumpre, e a pasta que a IA propôs criar.
 *
 * Exigir só a da IA anulava no cliente exatamente o resgate que o servidor oferece — quem
 * escolhia a categoria à mão na tela de revisão via "Classificação ausente" e o documento ficava
 * parado, com o arquivo já no storage.
 */
export function analysisHasResolvableCategory(
  payload: AnalyzePdfResponse,
  fallback?: {
    manualClassId?: string;
    documentRequestId?: string;
    categorySuggestionMode?: CategorySuggestionMode;
  },
): boolean {
  return (
    Boolean(payload.classification.classId) ||
    Boolean(fallback?.manualClassId?.trim()) ||
    // O pedido decide a categoria no servidor, e vence até a escolha de quem envia.
    Boolean(fallback?.documentRequestId?.trim()) ||
    /**
     * A quarta origem: a pasta que a IA propôs, quando o tenant escolheu criá-la sozinho.
     *
     * Sem este termo o modo `auto_create` era letra morta — o cliente recusava por falta de
     * categoria antes de o servidor ver o payload, e quem revisasse seria obrigado a escolher uma
     * pasta à mão, o que grava `manualClassId` e faz a criação automática nem ser tentada.
     *
     * Quem decide de verdade continua sendo o servidor: ele relê a política do tenant em
     * `resolveAutoCreatedCategoryId`. Aqui só deixamos o pedido chegar até lá.
     */
    (fallback?.categorySuggestionMode === 'auto_create' &&
      Boolean(payload.classification.suggestedCategory?.name?.trim()))
  );
}

export function validateConfirmableAnalysis(
  payload: AnalyzePdfResponse,
  fallback?: {
    manualClassId?: string;
    documentRequestId?: string;
    categorySuggestionMode?: CategorySuggestionMode;
  },
): string | null {
  if (!payload.jobId?.trim()) {
    return commonPhrase('uploadQueue.missingJobId');
  }

  if (!analysisHasResolvableCategory(payload, fallback)) {
    return commonPhrase('uploadQueue.missingCategory');
  }

  return null;
}
