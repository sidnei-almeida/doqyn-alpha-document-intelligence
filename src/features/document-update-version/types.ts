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
};

export type VersionComparisonRow = {
  key: string;
  label: string;
  currentValue: string;
  newValue: string;
  changed: boolean;
};

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
