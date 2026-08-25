import type { TenantUploadPolicy, UploadNamingPolicy } from '@shared/uploadPolicy';
import type { DocumentNamingMode } from '../utils/resolveDocumentNaming';

/** Política padrão de nomeação — definida pela organização (`shared/uploadPolicy.ts`). */
export type DefaultNamingPolicy = UploadNamingPolicy;

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
export type WorkflowReviewSettings = TenantUploadPolicy;

/** @deprecated a política agora vive no tenant; a chave só é lida para descartar o resíduo local. */
export const REVIEW_SETTINGS_STORAGE_KEY = 'doqyn.upload.reviewSettings';
