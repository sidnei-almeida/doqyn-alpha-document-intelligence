import type { ExtractedMetadata } from '@/features/document-send/types';
import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';
import { commonPhrase } from '@/i18n/commonPhrase';

/**
 * Quanto o navegador acompanha a análise antes de soltar o acompanhamento.
 *
 * Isto **não é um prazo de erro**. Enquanto o servidor responde que o documento está na fila ou
 * sendo analisado, esperar é o comportamento correto: a demora é a vazão do modelo, não uma falha.
 * O relógio antigo media a coisa errada — ele contava o tempo total e marcava erro vermelho num
 * documento que o servidor estava analisando naquele instante, e que aparecia na Biblioteca logo
 * depois. Chamar isso de erro é mentir para o usuário e convidar ao reenvio, que só aumenta a fila.
 *
 * O que sobra aqui é um teto de acompanhamento: passado ele, a aba para de perguntar e o item
 * avisa que a análise **continua no servidor**. Generoso de propósito — no plano gratuito, um lote
 * atrás de outros pode legitimamente levar meia hora.
 */
const UPLOAD_ANALYZE_MAX_WAIT_MIN_MS = 300_000;
const UPLOAD_ANALYZE_MAX_WAIT_MAX_MS = 7_200_000;
const UPLOAD_ANALYZE_MAX_WAIT_DEFAULT_MS = 1_800_000;

/** Interpreta VITE_UPLOAD_ANALYZE_MAX_WAIT_MS (testável sem import.meta). */
export function parseUploadAnalyzeMaxWaitMs(
  envValue: string | undefined | null,
  fallback = UPLOAD_ANALYZE_MAX_WAIT_DEFAULT_MS,
): number {
  if (envValue === undefined || envValue === null || envValue.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(envValue.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(UPLOAD_ANALYZE_MAX_WAIT_MAX_MS, Math.max(UPLOAD_ANALYZE_MAX_WAIT_MIN_MS, parsed));
}

const uploadAnalyzeMaxWaitEnv =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_UPLOAD_ANALYZE_MAX_WAIT_MS : undefined;

/**
 * Teto de acompanhamento do navegador.
 *
 * O antigo `VITE_UPLOAD_ANALYZE_TIMEOUT_MS` foi retirado de circulação em vez de renomeado: ele
 * media tempo total de espera como se fosse falha, e quem tinha 60s configurado colhia erro em
 * todo documento que pegasse fila. Pode sair do `.env`.
 */
export const UPLOAD_ANALYZE_MAX_WAIT_MS = parseUploadAnalyzeMaxWaitMs(uploadAnalyzeMaxWaitEnv);

export const UPLOAD_ANALYZE_MAX_WAIT_SECONDS = Math.round(UPLOAD_ANALYZE_MAX_WAIT_MS / 1000);

/** Quantas consultas seguidas podem falhar antes de o navegador considerar que perdeu o contato. */
export const UPLOAD_ANALYZE_MAX_POLL_FAILURES = 5;

/** O documento não falhou: o navegador é que parou de acompanhar. O texto precisa dizer isso. */
export function uploadAnalyzeStillRunningMessage(): string {
  return commonPhrase('uploadQueue.stillRunning');
}

/** Aqui sim houve falha, mas é de contato com o servidor, não do documento. */
export function uploadAnalyzePollFailureMessage(): string {
  return commonPhrase('uploadQueue.pollFailure');
}

export function analysisFailureMessage(
  status: AnalyzePdfResponse['status'],
  errorCode?: string | null,
): string {
  if (status === 'ai_unavailable') {
    if (errorCode === 'GROQ_DAILY_TOKEN_LIMIT') {
      return commonPhrase('uploadQueue.groqDailyLimit');
    }
    if (errorCode === 'GROQ_CONTEXT_LIMIT') {
      return commonPhrase('uploadQueue.contextLimit');
    }
    if (errorCode === 'GROQ_REQUEST_TIMEOUT') {
      return commonPhrase('uploadQueue.timeout');
    }
    return commonPhrase('uploadQueue.rateLimit');
  }
  return commonPhrase('uploadQueue.failed');
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
