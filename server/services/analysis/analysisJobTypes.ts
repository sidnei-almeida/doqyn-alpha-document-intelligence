import type { AnalyzePdfResponse, AnalyzePdfUpdateResponse } from '../../ai/types/documentAi.types.js';

export type AnalysisJobKind = 'initial' | 'version_update';

export type AnalysisJobResult = AnalyzePdfResponse | AnalyzePdfUpdateResponse;

export type AnalysisJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'requires_review'
  | 'ai_unavailable'
  | 'failed';

export type MongoAnalysisJob = {
  _id: string;
  tenantId: string;
  ownerUserId: string;
  status: AnalysisJobStatus;
  originalFileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  stagingKey?: string;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
  progress?: number;
  result?: AnalysisJobResult | null;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type AnalysisQueueJobPayload = {
  jobId: string;
  tenantId: string;
  ownerUserId: string;
  originalFileName: string;
  mimeType: string;
  fileHash: string;
  fileSizeBytes: number;
  stagingKey?: string;
  requestId?: string;
  batchId?: string;
  itemId?: string;
  jobKind?: AnalysisJobKind;
  documentId?: string;
  membershipId?: string;
};

export type AnalysisJobPollResponse = {
  jobId: string;
  status: AnalysisJobStatus;
  progress?: number;
  pollUrl: string;
  result?: AnalysisJobResult;
  errorCode?: string;
  errorMessage?: string;
};

export type AnalysisEnqueueResponse = {
  jobId: string;
  status: 'queued';
  pollUrl: string;
};
