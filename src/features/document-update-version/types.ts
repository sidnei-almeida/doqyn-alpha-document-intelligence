import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';
import type { ExtractedMetadata } from '@/features/document-send/types';
import type { DocumentDetailResponse } from '@/types/document-library';

export type UpdateVersionFlowPhase =
  | 'loading'
  | 'ready'
  | 'analyzing'
  | 'review'
  | 'confirming'
  | 'success'
  | 'error';

export type MetadataDisplayField = {
  key: string;
  label: string;
  value: string;
  /** Texto auxiliar (ex.: validade inferida). */
  hint?: string;
};

export type VersionComparisonLabelKey =
  | 'versionComparisonPanel.linhas.name'
  | 'versionComparisonPanel.linhas.category'
  | 'versionComparisonPanel.linhas.version'
  | 'versionComparisonPanel.linhas.summary';

/** Linha fixa leva `labelKey`, traduzida na tela; linha de metadado leva o `label` extraído. */
export type VersionComparisonRow = {
  key: string;
  currentValue: string;
  newValue: string;
  changed: boolean;
} & ({ label: string; labelKey?: never } | { labelKey: VersionComparisonLabelKey; label?: never });

export type UpdateVersionAnalysisResult = {
  file: File;
  metadata: ExtractedMetadata;
  raw: AnalyzePdfResponse;
};

export type UpdateVersionSuccess = {
  documentId: string;
  versionId: string;
  versionLabel: string;
};

export type UpdateVersionDrawerContext = {
  detail: DocumentDetailResponse;
  nextVersionLabel: string;
  currentVersionLabel: string;
};
