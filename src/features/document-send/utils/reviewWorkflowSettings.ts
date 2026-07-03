import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';
import type {
  DefaultNamingPolicy,
  PerItemNamingChoice,
  WorkflowReviewSettings,
} from '../types/reviewWorkflowSettings';
import {
  REVIEW_SETTINGS_STORAGE_KEY,
  REVIEW_SETTINGS_VERSION,
} from '../types/reviewWorkflowSettings';
import type { DocumentNamingMode } from './resolveDocumentNaming';
import { previewFinalFileName } from './resolveDocumentNaming';
import {
  AUTO_DELAY_SECONDS_DEFAULT,
  AUTO_DELAY_STORAGE_KEY,
  AUTO_MODE_STORAGE_KEY,
  clampAutoDelaySeconds,
  MIN_CLASSIFICATION_CONFIDENCE,
} from '../uploadConstants';
import { loadAutoDelaySeconds, loadAutoMode } from './autoDelayStorage';

export const DEFAULT_WORKFLOW_REVIEW_SETTINGS: WorkflowReviewSettings = {
  autoReviewEnabled: false,
  autoAcceptDelaySeconds: AUTO_DELAY_SECONDS_DEFAULT,
  pauseOnLowConfidence: true,
  pauseOnMissingFields: true,
  pauseOnSensitiveDocs: false,

  defaultNamingPolicy: 'ai_suggested',
  aiRenameEnabled: true,

  aiMetadataEnabled: true,
  aiClassificationEnabled: true,
  preventSensitiveDataInFileName: true,

  applyToBatch: false,
  pauseOnConflict: true,
  continueWhenSafe: true,
};

function mergeSettings(partial?: Partial<WorkflowReviewSettings>): WorkflowReviewSettings {
  return {
    ...DEFAULT_WORKFLOW_REVIEW_SETTINGS,
    ...partial,
    autoAcceptDelaySeconds: clampAutoDelaySeconds(
      partial?.autoAcceptDelaySeconds ?? DEFAULT_WORKFLOW_REVIEW_SETTINGS.autoAcceptDelaySeconds,
    ),
  };
}

/** Carrega settings com fallback das chaves legadas do modo Auto. */
export function loadReviewWorkflowSettings(): WorkflowReviewSettings {
  try {
    const raw = localStorage.getItem(REVIEW_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; settings?: Partial<WorkflowReviewSettings> };
      if (parsed?.settings && typeof parsed.settings === 'object') {
        return mergeSettings(parsed.settings);
      }
    }
  } catch {
    // ignore
  }

  return mergeSettings({
    autoReviewEnabled: loadAutoMode(),
    autoAcceptDelaySeconds: loadAutoDelaySeconds(),
  });
}

export function saveReviewWorkflowSettings(settings: WorkflowReviewSettings): void {
  const normalized = mergeSettings(settings);
  try {
    localStorage.setItem(
      REVIEW_SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: REVIEW_SETTINGS_VERSION, settings: normalized }),
    );
    localStorage.setItem(AUTO_MODE_STORAGE_KEY, normalized.autoReviewEnabled ? 'true' : 'false');
    localStorage.setItem(AUTO_DELAY_STORAGE_KEY, String(normalized.autoAcceptDelaySeconds));
  } catch {
    // ignore
  }
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
    const missing =
      rawAnalysis.extraction?.missingFields ?? metadata.missingFields ?? [];
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
  if (settings.aiRenameEnabled && namingMode === 'ai_suggested' && !input.rawAnalysis?.recommendedFileName?.trim()) {
    return false;
  }

  if (settings.defaultNamingPolicy === 'manual_required') return false;
  if (settings.defaultNamingPolicy === 'ask_each_file') return false;

  if (input.metadata?.analysisStatus !== 'completed' || input.rawAnalysis?.status !== 'completed') {
    return false;
  }

  return true;
}

export function getReviewSettingsSummaryLabel(settings: WorkflowReviewSettings): string | null {
  if (!settings.autoReviewEnabled) return null;
  return `Auto · ${settings.autoAcceptDelaySeconds}s`;
}

export const NAMING_POLICY_LABELS: Record<DefaultNamingPolicy, string> = {
  original: 'Manter nome original',
  ai_suggested: 'Usar nome sugerido pela IA',
  ask_each_file: 'Perguntar em cada arquivo',
  manual_required: 'Nome manual obrigatório',
};
