import type { ExtractedMetadata } from '@/features/document-send/types';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';
import {
  canAutoAcceptWithSettings,
  policyRequiresPerItemChoice,
  shouldPauseForReview,
} from '@/features/document-send/utils/reviewWorkflowSettings';
import type { PostAnalysisAction } from './uploadAutoConfirm';

/**
 * Decide o próximo passo da fila após a análise RAG, respeitando preferências do usuário.
 * A flag de deploy (VITE_UPLOAD_AUTO_CONFIRM_ENABLED) só força auto quando a análise é segura.
 */
export function resolveQueueAnalysisAction(
  settings: WorkflowReviewSettings,
  metadata: ExtractedMetadata,
  raw: AnalyzePdfResponse,
  options: { deployAutoConfirm: boolean; isAuthenticated: boolean },
): PostAnalysisAction {
  if (raw.status === 'failed' || raw.status === 'ai_unavailable') {
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
