export type DocumentPreviewStatus = 'ready' | 'failed' | 'skipped' | 'missing';

export type DocumentListItemPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canViewTracking: boolean;
  canEditMetadata: boolean;
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
  displayName: string;
  documentType: string;
  version: number;
  ownerUserId: string;
  ownerName?: string;
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
  type?: string;
  area?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string;
};
