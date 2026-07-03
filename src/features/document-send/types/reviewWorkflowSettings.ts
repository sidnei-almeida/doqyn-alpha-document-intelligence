import type { DocumentNamingMode } from '../utils/resolveDocumentNaming';

/** Política padrão de nomeação da sessão/lote. */
export type DefaultNamingPolicy =
  | 'original'
  | 'ai_suggested'
  | 'ask_each_file'
  | 'manual_required';

/** Escolha por arquivo (quando policy = ask_each_file ou revisão manual). */
export type PerItemNamingChoice = {
  namingMode: DocumentNamingMode;
  manualName?: string;
};

/**
 * Configurações unificadas do fluxo de revisão/confirmação.
 *
 * Mapa de estados legados (single vs bulk) documentado para migração:
 * - autoReviewEnabled ↔ autoMode (DocumentSendPage / useBulkUploadQueue)
 * - autoAcceptDelaySeconds ↔ autoDelaySeconds
 * - Single: countdown via useEffect; bulk via startCountdownSeconds()
 * - Single pausa em requires_review; bulk continuava — alinhado via pauseOnLowConfidence
 */
export type WorkflowReviewSettings = {
  autoReviewEnabled: boolean;
  autoAcceptDelaySeconds: number;
  pauseOnLowConfidence: boolean;
  pauseOnMissingFields: boolean;
  pauseOnSensitiveDocs: boolean;

  defaultNamingPolicy: DefaultNamingPolicy;
  aiRenameEnabled: boolean;

  aiMetadataEnabled: boolean;
  aiClassificationEnabled: boolean;
  preventSensitiveDataInFileName: boolean;

  applyToBatch: boolean;
  pauseOnConflict: boolean;
  continueWhenSafe: boolean;
};

export const REVIEW_SETTINGS_STORAGE_KEY = 'doqyn.upload.reviewSettings';
export const REVIEW_SETTINGS_VERSION = 1;
