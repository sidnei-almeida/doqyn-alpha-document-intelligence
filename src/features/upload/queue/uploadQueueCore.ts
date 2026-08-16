import type { AnalyzePdfResponse } from '../../document-send/services/analyzePdf';
import type { ExtractedMetadata } from '../../document-send/types';
import type {
  PerItemNamingChoice,
  WorkflowReviewSettings,
} from '../../document-send/types/reviewWorkflowSettings';
import { MIN_CLASSIFICATION_CONFIDENCE } from '../../document-send/uploadConstants';
import {
  canAutoAcceptWithSettings,
  DEFAULT_WORKFLOW_REVIEW_SETTINGS,
  policyRequiresPerItemChoice,
  resolveEffectiveNamingForItem,
  shouldPauseForReview,
} from '../../document-send/utils/reviewWorkflowSettings';
import type { PostAnalysisAction } from '../config/uploadAutoConfirm';
import type { UploadQueueItem, UploadQueueItemAnalysis } from '../types';
import type { BulkUploadItem } from '../../document-send/types/bulk';
import {
  analysisFailureMessage,
  needsManualReviewConfirmation,
} from './uploadQueueAnalysis';

export type AnalysisOutcomeStatus = 'analyzed' | 'requires_review' | 'ai_paused' | 'failed';

export type AnalysisOutcome = {
  status: AnalysisOutcomeStatus;
  classificationError: string | null;
};

export type AutoSaveParams = {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
  settings?: WorkflowReviewSettings;
  perItem?: PerItemNamingChoice | null;
};

/**
 * Estados que ocupam a esteira: enquanto um deles existe, o próximo arquivo não começa.
 *
 * `review` e `ai_paused` **não** entram aqui, e essa é a diferença que importa. Eles esperam uma
 * pessoa, não o servidor. Enquanto contavam como ocupados, um único arquivo mandado para revisão
 * parava o lote inteiro: os outros vinte ficavam em "Na fila" até alguém abrir a tela e resolver o
 * primeiro. Numa empresa enviando o acervo, isso obriga uma pessoa sentada na tela a cada arquivo.
 */
export const UPLOAD_IN_FLIGHT_STATUSES = ['analyzing', 'confirming'] as const;

/** Estados parados esperando decisão humana. Saem da esteira sem sair da fila. */
export const UPLOAD_PARKED_STATUSES = ['review', 'ai_paused'] as const;
export const BULK_IN_FLIGHT_STATUSES = ['analyzing', 'saving', 'auto_countdown'] as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type CountdownHandle = {
  cancel: () => void;
  completed: Promise<boolean>;
};

/** Countdown de auto-confirmação compartilhado entre filas. */
export function startCountdownSeconds(
  seconds: number,
  onTick: (remaining: number) => void,
  shouldContinue: () => boolean,
): CountdownHandle {
  let remaining = seconds;
  let intervalId: number | null = null;
  let resolveCompleted: (value: boolean) => void = () => undefined;

  const completed = new Promise<boolean>((resolve) => {
    resolveCompleted = resolve;
  });

  const cancel = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    resolveCompleted(false);
  };

  if (!shouldContinue()) {
    resolveCompleted(false);
    return { cancel, completed: Promise.resolve(false) };
  }

  // 0s = confirma imediatamente (sem intervalo de 1s).
  if (seconds <= 0) {
    onTick(0);
    resolveCompleted(true);
    return { cancel, completed: Promise.resolve(true) };
  }

  onTick(remaining);

  intervalId = window.setInterval(() => {
    if (!shouldContinue()) {
      cancel();
      return;
    }

    remaining -= 1;
    if (remaining <= 0) {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      onTick(0);
      resolveCompleted(true);
      return;
    }

    onTick(remaining);
  }, 1000);

  return { cancel, completed };
}

export function findNextQueuedItem<T extends { status: string }>(items: T[]): T | null {
  return items.find((item) => item.status === 'queued') ?? null;
}

/**
 * Próximo enfileirado ignorando os que já foram despachados.
 *
 * Com mais de uma análise em voo, o despacho acontece antes de o React repintar a lista: os itens
 * recém-iniciados ainda constam como `queued` no instantâneo, e sem a exclusão o mesmo arquivo
 * seria enviado duas vezes na mesma rodada.
 */
export function findNextQueuedItemExcluding<T extends { id: string; status: string }>(
  items: T[],
  excludedIds: ReadonlySet<string>,
): T | null {
  return items.find((item) => item.status === 'queued' && !excludedIds.has(item.id)) ?? null;
}

export function hasInFlightItem<T extends { status: string }>(
  items: T[],
  inFlightStatuses: readonly string[],
): boolean {
  return items.some((item) => inFlightStatuses.includes(item.status));
}

export function hasInFlightUploadItem(items: UploadQueueItem[]): boolean {
  return hasInFlightItem(items, UPLOAD_IN_FLIGHT_STATUSES);
}

/** Quantos arquivos estão parados esperando alguém decidir. */
export function countParkedUploadItems(items: UploadQueueItem[]): number {
  return items.filter((item) =>
    UPLOAD_PARKED_STATUSES.includes(item.status as (typeof UPLOAD_PARKED_STATUSES)[number]),
  ).length;
}

export function hasInFlightBulkItem(items: BulkUploadItem[]): boolean {
  return hasInFlightItem(items, BULK_IN_FLIGHT_STATUSES);
}

export function isBulkInFlightStatus(status: string): boolean {
  return BULK_IN_FLIGHT_STATUSES.includes(status as (typeof BULK_IN_FLIGHT_STATUSES)[number]);
}

export function getAnalysisClassificationError(
  raw: AnalyzePdfResponse,
  metadata: ExtractedMetadata,
): string | null {
  if (raw.status === 'ai_unavailable' || raw.classification.errorCode === 'GROQ_RATE_LIMIT') {
    return (
      raw.classification.reason ||
      analysisFailureMessage(raw.status, raw.classification.errorCode)
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

export function resolveAnalysisOutcome(
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
): AnalysisOutcome {
  if (raw.status === 'ai_unavailable' || raw.classification.errorCode === 'GROQ_RATE_LIMIT') {
    return {
      status: 'ai_paused',
      classificationError: getAnalysisClassificationError(raw, metadata),
    };
  }

  if (metadata.analysisStatus === 'failed' || raw.status === 'failed') {
    return {
      status: 'failed',
      classificationError:
        getAnalysisClassificationError(raw, metadata) ??
        raw.classification.reason ??
        'A análise não foi concluída.',
    };
  }

  // requires_review pode vir sem classId (ex.: classificação inconclusiva) —
  // não tratar como failed antes deste check.
  if (raw.status === 'requires_review' || metadata.analysisStatus === 'requires_review') {
    return { status: 'requires_review', classificationError: null };
  }

  if (!raw.classification.classId || !raw.classification.className) {
    return {
      status: 'failed',
      classificationError:
        getAnalysisClassificationError(raw, metadata) ??
        'A análise não retornou identificação de classe para este documento.',
    };
  }

  return { status: 'analyzed', classificationError: null };
}

export function getAutoSaveBlockers(params: AutoSaveParams): string[] {
  const settings = params.settings ?? DEFAULT_WORKFLOW_REVIEW_SETTINGS;
  const blockers: string[] = [];
  const { isAuthenticated, metadata, rawAnalysis } = params;

  if (!isAuthenticated) blockers.push('Usuário não autenticado.');
  if (!metadata || !rawAnalysis) {
    blockers.push('Análise indisponível.');
    return blockers;
  }

  if (policyRequiresPerItemChoice(settings.defaultNamingPolicy) && !params.perItem?.namingMode) {
    blockers.push('Escolha de nome por arquivo necessária.');
  }

  if (settings.defaultNamingPolicy === 'manual_required' && !params.perItem?.manualName?.trim()) {
    blockers.push('Nome manual obrigatório.');
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
  if (
    settings.pauseOnLowConfidence &&
    rawAnalysis.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE
  ) {
    blockers.push(
      `Confiança abaixo do mínimo (${Math.round(rawAnalysis.classification.confidence * 100)}%).`,
    );
  }
  if (!rawAnalysis.classification.classId) {
    blockers.push('Classe não retornada pela análise.');
  }

  const effectiveMode = resolveEffectiveNamingForItem(settings, params.perItem);
  if (
    settings.aiRenameEnabled &&
    effectiveMode === 'ai_suggested' &&
    !rawAnalysis.recommendedFileName?.trim()
  ) {
    blockers.push('Nome sugerido ausente.');
  }
  if (!settings.aiRenameEnabled && !rawAnalysis.originalFileName?.trim()) {
    blockers.push('Nome original ausente.');
  }
  if (!rawAnalysis.extraction) {
    blockers.push('Metadados não extraídos.');
  }
  if (settings.pauseOnLowConfidence && rawAnalysis.extraction?.requiresReview) {
    blockers.push('Metadados marcados para revisão.');
  }

  const missingFields = rawAnalysis.extraction?.missingFields ?? metadata.missingFields ?? [];
  if (settings.pauseOnMissingFields && missingFields.length > 0) {
    blockers.push(`Campos ausentes: ${missingFields.join(', ')}.`);
  }

  if (
    !canAutoAcceptWithSettings(settings, {
      ...params,
      autoPaused: false,
      saved: false,
    })
  ) {
    if (blockers.length === 0) {
      blockers.push('Documento não elegível para salvamento automático.');
    }
  }

  return blockers;
}

export function canAutoSave(params: AutoSaveParams): boolean {
  return getAutoSaveBlockers(params).length === 0;
}

export function canManualConfirm(params: AutoSaveParams): boolean {
  if (!params.isAuthenticated) return false;

  const settings = params.settings ?? DEFAULT_WORKFLOW_REVIEW_SETTINGS;
  const { metadata, rawAnalysis } = params;
  if (!metadata || !rawAnalysis) return false;
  if (metadata.analysisStatus === 'failed' || rawAnalysis.status === 'failed') return false;
  if (!rawAnalysis.classification.classId) return false;

  const effectiveMode = resolveEffectiveNamingForItem(settings, params.perItem);
  if (
    settings.aiRenameEnabled &&
    effectiveMode === 'ai_suggested' &&
    !rawAnalysis.recommendedFileName?.trim()
  ) {
    return false;
  }
  if (!settings.aiRenameEnabled && !rawAnalysis.originalFileName?.trim()) {
    return false;
  }
  if (effectiveMode === 'manual') {
    const resolved = params.perItem?.manualName?.trim();
    if (!resolved) return false;
  }
  if (!rawAnalysis.extraction) return false;

  if (metadata.analysisStatus === 'completed' && rawAnalysis.status === 'completed') {
    return true;
  }

  if (metadata.analysisStatus === 'requires_review' || rawAnalysis.status === 'requires_review') {
    return true;
  }

  return false;
}

/**
 * Decide o próximo passo da fila após análise RAG, respeitando preferências do usuário.
 * Usado pela fila da Biblioteca (UploadQueueProvider).
 */
export function resolveQueueAnalysisAction(
  settings: WorkflowReviewSettings,
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
  options: { deployAutoConfirm: boolean; isAuthenticated: boolean },
): PostAnalysisAction {
  if (
    raw.status === 'ai_unavailable' ||
    raw.classification.errorCode === 'GROQ_RATE_LIMIT' ||
    raw.classification.errorCode === 'GROQ_DAILY_TOKEN_LIMIT' ||
    raw.classification.errorCode === 'GROQ_CONTEXT_LIMIT'
  ) {
    return 'ai_pause';
  }

  if (raw.status === 'failed') {
    return 'fail';
  }

  const pauseInput = { metadata, rawAnalysis: raw };

  if (shouldPauseForReview(settings, pauseInput)) {
    return 'open_review';
  }

  if (policyRequiresPerItemChoice(settings.defaultNamingPolicy)) {
    return 'open_review';
  }

  if (settings.defaultNamingPolicy === 'manual_required') {
    return 'open_review';
  }

  if (
    canAutoAcceptWithSettings(settings, {
      ...pauseInput,
      isAuthenticated: options.isAuthenticated,
    })
  ) {
    return 'auto_confirm';
  }

  if (
    options.deployAutoConfirm &&
    raw.status === 'completed' &&
    !shouldPauseForReview(settings, pauseInput)
  ) {
    return 'auto_confirm';
  }

  if (raw.status === 'completed' || raw.status === 'requires_review') {
    return 'open_review';
  }

  return 'fail';
}

export function normalizeUploadQueueAnalysis(
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
): UploadQueueItemAnalysis {
  return {
    metadata: {
      ...metadata,
      analysisStatus: raw.status,
      documentType: raw.classification.className ?? metadata.documentType,
      confidenceScore: raw.classification.confidence,
      reviewReasons:
        raw.extraction?.reviewReasons ??
        (raw.classification.reviewReason
          ? [raw.classification.reviewReason]
          : metadata.reviewReasons),
    },
    raw,
  };
}

export function getReviewReasonFromBlockers(
  item: Pick<BulkUploadItem, 'errorMessage' | 'result' | 'metadata' | 'perItemNaming'>,
  settings: WorkflowReviewSettings = DEFAULT_WORKFLOW_REVIEW_SETTINGS,
): string {
  if (item.errorMessage) return item.errorMessage;

  const raw = item.result;
  const metadata = item.metadata;
  if (!raw || !metadata) return 'Análise indisponível.';

  const blockers = getAutoSaveBlockers({
    isAuthenticated: true,
    metadata,
    rawAnalysis: raw,
    settings,
    perItem: item.perItemNaming,
  });

  if (blockers.length > 0) {
    return blockers[0];
  }

  if (raw.status === 'requires_review' || metadata.analysisStatus === 'requires_review') {
    return raw.classification.reason || 'Resultado marcado para revisão pela análise.';
  }

  return 'Revisão necessária antes do salvamento.';
}

export { analysisFailureMessage, needsManualReviewConfirmation };
