export type DocumentPreviewStatus = 'ready' | 'failed' | 'skipped' | 'missing';

export type DocumentSignatureSummaryStatus =
  | 'none'
  | 'pending'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type DocumentSignatureSummarySigner = {
  name: string;
  signedAt: string;
};

export type DocumentSignatureSummary = {
  status: DocumentSignatureSummaryStatus;
  pendingCount: number;
  signedCount: number;
  signedSigners: DocumentSignatureSummarySigner[];
  latestRequestId?: string;
  latestSignatureId?: string;
  latestSignedAt?: string;
  latestSignerName?: string;
  hasSignedPdf: boolean;
  verificationCode?: string;
};

export type DocumentListItemPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canViewTracking: boolean;
  canEditMetadata: boolean;
  canUpdate?: boolean;
  canShare?: boolean;
  canTransferOwnership?: boolean;
  sharedViaGrant?: boolean;
};

export type DocumentSharePermissions = {
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
};

export type DocumentListItem = {
  documentId: string;
  id: string;
  tenantId: string;
  currentFileName: string;
  categoryId?: string;
  categoryName?: string;
  status: string;
  latestVersionId?: string;
  currentVersionId?: string;
  versionLabel?: string;
  currentVersionLabel?: string;
  displayName: string;
  documentType: string;
  version: number;
  versionCount?: number;
  ownerUserId: string;
  ownerName?: string;
  updatedBy?: string;
  updatedByName?: string;
  area?: string;
  accessGroups?: string[];
  metadata?: Record<string, unknown>;
  processingStatus?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    userId?: string;
    displayName?: string;
    email?: string;
  };
  preview?: {
    status: DocumentPreviewStatus;
  };
  storage?: {
    hasOriginal: boolean;
    hasPreview: boolean;
  };
  permissions?: DocumentListItemPermissions;
  isFavorite?: boolean;
  signatureSummary?: DocumentSignatureSummary;
  sharedWithMe?: boolean;
  sharedByUserId?: string;
  sharedByNameSnapshot?: string;
  sharedAt?: string;
  sharePermissions?: DocumentSharePermissions;
  deletedAt?: string;
  trashExpiresAt?: string | null;
  lifecycleStatus?: string;
};

export type DocumentVersionSummary = {
  versionId: string;
  versionLabel?: string;
  finalFileName?: string;
  originalFileName?: string;
  storageFileName?: string;
  previewStorageFileName?: string;
  previewStatus?: DocumentPreviewStatus;
  createdAt?: string;
  createdBy?: string;
  createdByDisplayName?: string;
  isCurrent?: boolean;
  preview?: {
    status: DocumentPreviewStatus;
  };
};

export type DocumentPermissions = DocumentListItemPermissions;

export type DocumentDetailResponse = {
  document: DocumentListItem;
  latestVersion: DocumentVersionSummary | null;
  versions: DocumentVersionSummary[];
  metadata: Record<string, unknown>;
  permissions: DocumentPermissions;
};

export type DocumentListResponse = {
  items: DocumentListItem[];
  documents: DocumentListItem[];
  total: number;
  pagination: {
    nextCursor: string | null;
  };
};

export type DocumentListFilters = {
  search?: string;
  categoryId?: string;
  status?: string;
  processingStatus?: string;
  type?: string;
  area?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
  owner?: string;
  excludeArchived?: string;
  cursor?: string;
  limit?: string;
};
