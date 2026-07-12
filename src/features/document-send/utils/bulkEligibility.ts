import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';
import type { BulkUploadItem } from '../types/bulk';
import type { PerItemNamingChoice, WorkflowReviewSettings } from '../types/reviewWorkflowSettings';
import { DEFAULT_WORKFLOW_REVIEW_SETTINGS } from './reviewWorkflowSettings';
import {
  canAutoSave,
  canManualConfirm,
  getAnalysisClassificationError,
  getAutoSaveBlockers,
  getReviewReasonFromBlockers,
  resolveAnalysisOutcome,
} from '../../upload/queue/uploadQueueCore';

/** @deprecated Use getAutoSaveBlockers de uploadQueueCore */
export function getBulkAutoSaveBlockers(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
  settings?: WorkflowReviewSettings;
  perItem?: PerItemNamingChoice | null;
}): string[] {
  return getAutoSaveBlockers(params);
}

/** @deprecated Use canAutoSave de uploadQueueCore */
export function canBulkAutoSave(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
  settings?: WorkflowReviewSettings;
  perItem?: PerItemNamingChoice | null;
}): boolean {
  return canAutoSave(params);
}

/** @deprecated Use canManualConfirm de uploadQueueCore */
export function canBulkManualConfirm(params: {
  isAuthenticated: boolean;
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
  settings?: WorkflowReviewSettings;
  perItem?: PerItemNamingChoice | null;
}): boolean {
  return canManualConfirm(params);
}

export { getAnalysisClassificationError };

/**
 * Status na fila bulk espelha a resposta da API via uploadQueueCore.
 */
export function resolveBulkItemStatusAfterAnalysis(
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
): 'analyzed' | 'requires_review' | 'ai_paused' | 'error' {
  const outcome = resolveAnalysisOutcome(metadata, raw);
  if (outcome.status === 'failed') return 'error';
  return outcome.status;
}

export function getBulkReviewReason(
  item: BulkUploadItem,
  settings: WorkflowReviewSettings = DEFAULT_WORKFLOW_REVIEW_SETTINGS,
): string {
  return getReviewReasonFromBlockers(item, settings);
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
