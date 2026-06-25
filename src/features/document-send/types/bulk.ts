import type { AnalyzePdfResponse } from '../services/analyzePdf';
import type { ExtractedMetadata } from '../types';

export type BulkUploadItemStatus =
  | 'queued'
  | 'analyzing'
  | 'analyzed'
  | 'auto_countdown'
  | 'saving'
  | 'saved'
  | 'requires_review'
  | 'ai_paused'
  | 'unclassified'
  | 'error'
  | 'skipped';

export type BulkUploadItem = {
  id: string;
  file: File;
  originalFileName: string;
  sizeBytes: number;
  status: BulkUploadItemStatus;
  result?: AnalyzePdfResponse;
  metadata?: ExtractedMetadata;
  documentId?: string;
  versionId?: string;
  recommendedFileName?: string;
  finalFileName?: string;
  className?: string;
  confidence?: number;
  errorMessage?: string;
  logs: string[];
  startedAt?: string;
  finishedAt?: string;
};

export type BulkBatchLogLevel = 'info' | 'success' | 'warning' | 'error';

export type BulkBatchLogEntry = {
  id: string;
  timestamp: string;
  message: string;
  level: BulkBatchLogLevel;
  fileName?: string;
};

export type BulkBatchPhase = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

export type BulkBatchStats = {
  total: number;
  processed: number;
  saved: number;
  requiresReview: number;
  errors: number;
  skipped: number;
  pending: number;
};
