import type { ExtractedMetadata } from '@/features/document-send/types';
import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';

const UPLOAD_ANALYZE_TIMEOUT_MIN_MS = 30_000;
const UPLOAD_ANALYZE_TIMEOUT_MAX_MS = 90_000;
const UPLOAD_ANALYZE_TIMEOUT_DEFAULT_MS = 60_000;

/** Interpreta VITE_UPLOAD_ANALYZE_TIMEOUT_MS (testável sem import.meta). */
export function parseUploadAnalyzeTimeoutMs(
  envValue: string | undefined | null,
  fallback = UPLOAD_ANALYZE_TIMEOUT_DEFAULT_MS,
): number {
  if (envValue === undefined || envValue === null || envValue.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(envValue.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(UPLOAD_ANALYZE_TIMEOUT_MAX_MS, Math.max(UPLOAD_ANALYZE_TIMEOUT_MIN_MS, parsed));
}

const uploadAnalyzeTimeoutEnv =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_UPLOAD_ANALYZE_TIMEOUT_MS
    : undefined;

/** Tempo máximo aguardando analyzePdf antes de marcar erro na fila. */
export const UPLOAD_ANALYZE_TIMEOUT_MS = parseUploadAnalyzeTimeoutMs(uploadAnalyzeTimeoutEnv);

export const UPLOAD_ANALYZE_TIMEOUT_SECONDS = Math.round(UPLOAD_ANALYZE_TIMEOUT_MS / 1000);

export function uploadAnalyzeTimeoutMessage(): string {
  return `A análise passou de ${UPLOAD_ANALYZE_TIMEOUT_SECONDS}s e foi cancelada. Tente novamente ou envie um PDF menor.`;
}

export function analysisFailureMessage(
  status: AnalyzePdfResponse['status'],
  errorCode?: string | null,
): string {
  if (status === 'ai_unavailable') {
    if (errorCode === 'GROQ_DAILY_TOKEN_LIMIT') {
      return 'Cota diária de tokens do modelo Groq esgotada. Aguarde o reset (~1h) ou altere GROQ_MODEL para openai/gpt-oss-20b.';
    }
    if (errorCode === 'GROQ_CONTEXT_LIMIT') {
      return 'O documento é grande demais para o modelo atual. Reduza o tamanho do PDF ou ajuste PDF_ANALYSIS_MAX_INPUT_CHARS.';
    }
    if (errorCode === 'GROQ_REQUEST_TIMEOUT') {
      return 'A análise automática demorou demais e foi interrompida. Tente novamente.';
    }
    return 'Limite temporário da Groq atingido. Aguarde alguns minutos e tente novamente.';
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
