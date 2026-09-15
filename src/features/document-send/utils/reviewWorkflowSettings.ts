import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';
import type {
  DefaultNamingPolicy,
  PerItemNamingChoice,
  WorkflowReviewSettings,
} from '../types/reviewWorkflowSettings';
import { DEFAULT_TENANT_UPLOAD_POLICY, normalizeTenantUploadPolicy } from '@shared/uploadPolicy';
import type { DocumentNamingMode } from './resolveDocumentNaming';
import { previewFinalFileName } from './resolveDocumentNaming';
import { MIN_CLASSIFICATION_CONFIDENCE } from '../uploadConstants';

/** Padrão de fábrica da política — o valor real vem do tenant (`/api/settings/upload-policy`). */
export const DEFAULT_WORKFLOW_REVIEW_SETTINGS: WorkflowReviewSettings =
  DEFAULT_TENANT_UPLOAD_POLICY;

function mergeSettings(partial?: Partial<WorkflowReviewSettings>): WorkflowReviewSettings {
  return normalizeTenantUploadPolicy(partial);
}

export function cloneReviewWorkflowSettings(
  settings: WorkflowReviewSettings,
): WorkflowReviewSettings {
  return mergeSettings(settings);
}

export function policyRequiresPerItemChoice(policy: DefaultNamingPolicy): boolean {
  return policy === 'ask_each_file' || policy === 'manual_required';
}

/** Resolve modo enviado ao confirm (somente original | ai_suggested | manual). */
export function resolveEffectiveNamingForItem(
  settings: WorkflowReviewSettings,
  perItem?: PerItemNamingChoice | null,
): DocumentNamingMode {
  if (!settings.aiRenameEnabled) {
    if (perItem?.namingMode === 'manual' && perItem.manualName?.trim()) {
      return 'manual';
    }
    return 'original';
  }

  if (settings.defaultNamingPolicy === 'manual_required') {
    return perItem?.namingMode === 'manual' && perItem.manualName?.trim() ? 'manual' : 'manual';
  }

  if (settings.defaultNamingPolicy === 'original') {
    return perItem?.namingMode ?? 'original';
  }

  if (settings.defaultNamingPolicy === 'ai_suggested') {
    return perItem?.namingMode ?? 'ai_suggested';
  }

  // ask_each_file — exige escolha por item; fallback original até escolher
  return perItem?.namingMode ?? 'original';
}

export function resolveFinalFileNameForConfirm(input: {
  settings: WorkflowReviewSettings;
  originalFileName: string;
  aiSuggestedFileName: string;
  perItem?: PerItemNamingChoice | null;
}): string {
  const namingMode = resolveEffectiveNamingForItem(input.settings, input.perItem);
  return previewFinalFileName({
    originalFileName: input.originalFileName,
    aiSuggestedFileName: input.aiSuggestedFileName,
    namingMode,
    manualName: input.perItem?.manualName,
  });
}

export type ReviewPauseAnalysisInput = {
  metadata: ExtractedMetadata | null;
  rawAnalysis: AnalyzePdfResponse | null;
};

export function shouldPauseForReview(
  settings: WorkflowReviewSettings,
  input: ReviewPauseAnalysisInput,
): boolean {
  const { metadata, rawAnalysis } = input;
  if (!metadata || !rawAnalysis) return true;

  if (metadata.analysisStatus === 'requires_review' || rawAnalysis.status === 'requires_review') {
    return settings.pauseOnConflict;
  }

  if (settings.pauseOnLowConfidence) {
    if (rawAnalysis.classification.confidence < MIN_CLASSIFICATION_CONFIDENCE) return true;
    if (rawAnalysis.classification.requiresReview) return true;
    if (rawAnalysis.extraction?.requiresReview) return true;
  }

  if (settings.pauseOnMissingFields) {
    const missing = rawAnalysis.extraction?.missingFields ?? metadata.missingFields ?? [];
    if (missing.length > 0) return true;
  }

  if (!rawAnalysis.classification.classId) return true;

  return false;
}

export function canAutoAcceptWithSettings(
  settings: WorkflowReviewSettings,
  input: ReviewPauseAnalysisInput & {
    isAuthenticated: boolean;
    autoPaused?: boolean;
    saved?: boolean;
  },
): boolean {
  if (!settings.autoReviewEnabled || !input.isAuthenticated || input.autoPaused || input.saved) {
    return false;
  }

  if (shouldPauseForReview(settings, input)) return false;

  const namingMode = resolveEffectiveNamingForItem(settings);
  if (!settings.aiRenameEnabled && !input.rawAnalysis?.originalFileName?.trim()) return false;
  if (
    settings.aiRenameEnabled &&
    namingMode === 'ai_suggested' &&
    !input.rawAnalysis?.recommendedFileName?.trim()
  ) {
    return false;
  }

  if (settings.defaultNamingPolicy === 'manual_required') return false;
  if (settings.defaultNamingPolicy === 'ask_each_file') return false;

  if (input.metadata?.analysisStatus !== 'completed' || input.rawAnalysis?.status !== 'completed') {
    return false;
  }

  return true;
}

/**
 * Chaves com namespace explícito: a política aparece no painel de envio (`documentSend`) e no
 * resumo das configurações (`settings`), e a mesma chave precisa resolver nos dois.
 */
export const NAMING_POLICY_LABEL_KEYS: Record<DefaultNamingPolicy, string> = {
  original: 'documentSend:namingPolicy.label.original',
  ai_suggested: 'documentSend:namingPolicy.label.aiSuggested',
  ask_each_file: 'documentSend:namingPolicy.label.askEachFile',
  manual_required: 'documentSend:namingPolicy.label.manualRequired',
};

export const NAMING_POLICY_DESCRIPTION_KEYS: Record<DefaultNamingPolicy, string> = {
  original: 'documentSend:namingPolicy.description.original',
  ai_suggested: 'documentSend:namingPolicy.description.aiSuggested',
  ask_each_file: 'documentSend:namingPolicy.description.askEachFile',
  manual_required: 'documentSend:namingPolicy.description.manualRequired',
};
