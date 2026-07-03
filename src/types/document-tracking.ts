export type DocumentTrackingFilters = {
  q?: string;
  documentId?: string;
  versionId?: string;
  action?: string;
  severity?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  category?: string;
};

export type DocumentTrackingListItem = {
  id: string;
  occurredAt: string;
  action: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  summary: string;
  document: {
    documentId: string | null;
    name: string;
    versionLabel?: string;
  };
  versionId?: string | null;
  actor: {
    userId: string;
    displayName?: string;
    email?: string;
  };
  hasChanges: boolean;
};

export type DocumentTrackingDetail = DocumentTrackingListItem & {
  tenantId: string;
  description: string;
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  requestId?: string;
  durationMs?: number;
};

export type DocumentTrackingListResponse = {
  items: DocumentTrackingListItem[];
  pagination: {
    nextCursor: string | null;
  };
};
