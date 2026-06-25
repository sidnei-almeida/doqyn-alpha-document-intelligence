import { MIN_CLASSIFICATION_CONFIDENCE } from '../uploadConstants';
import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';
import type { BulkUploadItem } from '../types/bulk';

export function getBulkAutoSaveBlockers(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
}): string[] {
  const blockers: string[] = [];
  const { isAuthenticated, metadata, rawAnalysis } = params;

  if (!isAuthenticated) blockers.push('Usuário não autenticado.');
  if (!metadata || !rawAnalysis) {
    blockers.push('Análise indisponível.');
    return blockers;
  }
  if (metadata.analysisStatus !== 'completed') {
    blockers.push('Análise marcada como revisão pela API.');
  }
  if (rawAnalysis.status !== 'completed') {
    blockers.push('Status da análise não é concluído.');
  }
  if (rawAnalysis.classification.requiresReview) {
    blockers.push('Classificação marcada para revisão.');
  }
  if (rawAnalysis.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) {
    blockers.push(
      `Confiança abaixo do mínimo (${Math.round(rawAnalysis.classification.confidence * 100)}%).`,
    );
  }
  if (!rawAnalysis.classification.classId) {
    blockers.push('Classe não retornada pela análise.');
  }
  if (!rawAnalysis.recommendedFileName?.trim()) {
    blockers.push('Nome sugerido ausente.');
  }
  if (!rawAnalysis.extraction) {
    blockers.push('Metadados não extraídos.');
  }
  if (rawAnalysis.extraction?.requiresReview) {
    blockers.push('Metadados marcados para revisão.');
  }

  const missingFields = rawAnalysis.extraction?.missingFields ?? metadata.missingFields ?? [];
  if (missingFields.length > 0) {
    blockers.push(`Campos ausentes: ${missingFields.join(', ')}.`);
  }

  return blockers;
}

export function canBulkAutoSave(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
}): boolean {
  return getBulkAutoSaveBlockers(params).length === 0;
}

export function canBulkManualConfirm(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
}): boolean {
  if (!params.isAuthenticated) return false;

  const { metadata, rawAnalysis } = params;
  if (!metadata || !rawAnalysis) return false;
  if (metadata.analysisStatus === 'failed' || rawAnalysis.status === 'failed') return false;
  if (!rawAnalysis.classification.classId || !rawAnalysis.recommendedFileName?.trim()) return false;
  if (!rawAnalysis.extraction) return false;

  if (metadata.analysisStatus === 'completed' && rawAnalysis.status === 'completed') {
    return true;
  }

  if (metadata.analysisStatus === 'requires_review' || rawAnalysis.status === 'requires_review') {
    return true;
  }

  return false;
}

/** Mensagem de erro real quando a API não retorna classe — sem categoria fake. */
export function getAnalysisClassificationError(
  raw: AnalyzePdfResponse,
  metadata: ExtractedMetadata,
): string | null {
  if (raw.status === 'ai_unavailable' || raw.classification.errorCode === 'GROQ_RATE_LIMIT') {
    return (
      raw.classification.reason ||
      'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.'
    );
  }

  if (metadata.analysisStatus === 'failed' || raw.status === 'failed') {
    return metadata.classificationReason || 'A análise não foi concluída.';
  }

  if (!raw.classification.classId || !raw.classification.className) {
    return (
      raw.classification.reason ||
      'A análise não retornou identificação de classe para este documento.'
    );
  }

  return null;
}

/**
 * Status na fila espelha a resposta da API.
 * Sem status `unclassified` — falha de classificação vira `error` com motivo real.
 */
export function resolveBulkItemStatusAfterAnalysis(
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
): 'analyzed' | 'requires_review' | 'ai_paused' | 'error' {
  if (raw.status === 'ai_unavailable' || raw.classification.errorCode === 'GROQ_RATE_LIMIT') {
    return 'ai_paused';
  }

  if (metadata.analysisStatus === 'failed' || raw.status === 'failed') {
    return 'error';
  }

  if (!raw.classification.classId || !raw.classification.className) {
    return 'error';
  }

  if (
    raw.status === 'requires_review' ||
    metadata.analysisStatus === 'requires_review'
  ) {
    return 'requires_review';
  }

  return 'analyzed';
}

export function getBulkReviewReason(item: BulkUploadItem): string {
  if (item.errorMessage) return item.errorMessage;

  const raw = item.result;
  const metadata = item.metadata;
  if (!raw || !metadata) return 'Análise indisponível.';

  const blockers = getBulkAutoSaveBlockers({
    isAuthenticated: true,
    metadata,
    rawAnalysis: raw,
  });

  if (blockers.length > 0) {
    return blockers[0];
  }

  if (raw.status === 'requires_review' || metadata.analysisStatus === 'requires_review') {
    return raw.classification.reason || 'Resultado marcado para revisão pela análise.';
  }

  return 'Revisão necessária antes do salvamento.';
}

export function computeBulkStats(
  items: BulkUploadItem[],
): import('../types/bulk').BulkBatchStats {
  const terminal = new Set(['saved', 'requires_review', 'ai_paused', 'error', 'skipped']);

  return {
    total: items.length,
    processed: items.filter((i) => terminal.has(i.status) || i.status === 'analyzed').length,
    saved: items.filter((i) => i.status === 'saved').length,
    requiresReview: items.filter((i) => i.status === 'requires_review').length,
    errors: items.filter((i) => i.status === 'error').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    pending: items.filter((i) =>
      ['queued', 'analyzing', 'auto_countdown', 'saving', 'analyzed'].includes(i.status),
    ).length,
  };
}
