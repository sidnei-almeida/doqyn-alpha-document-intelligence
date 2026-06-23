export type DocumentStatus =
  | 'processed'
  | 'analyzing'
  | 'updated'
  | 'pending_review'
  | 'needs_review'
  | 'available'
  | 'pending_analysis'
  | 'update_processed'
  | 'review_required';

export type ProcessingStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Document {
  id: string;
  tenantId: string;
  originalFileName: string;
  displayName: string;
  documentType: string;
  status: DocumentStatus;
  version: number;
  currentVersionId: string;
  ownerUserId: string;
  ownerName: string;
  area: string;
  accessGroups: string[];
  metadata: Record<string, unknown>;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  originalFileName: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: string;
  changeNotes?: string;
  status: DocumentStatus;
  metadata: Record<string, unknown>;
  storageRef?: string;
}

export interface UploadDocumentPayload {
  file: File;
  documentType: string;
  accessGroups: string[];
  notes?: string;
}
