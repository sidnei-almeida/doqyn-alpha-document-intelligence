export type TrackingListStatus = 'success' | 'failed' | 'denied' | 'pending';

export type DocumentTrackingFilters = {
  q?: string;
  documentId?: string;
  versionId?: string;
  action?: string;
  severity?: string;
  status?: string;
  actionGroup?: string;
  requestId?: string;
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
  status?: TrackingListStatus;
  actionGroup?: string;
  result?: string;
  sessionHash?: string;
};

export type DocumentTrackingDetail = DocumentTrackingListItem & {
  tenantId: string;
  description: string;
  changes?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  requestId?: string;
  durationMs?: number;
  security?: Record<string, unknown>;
};

export type DocumentTrackingListResponse = {
  items: DocumentTrackingListItem[];
  pagination: {
    nextCursor: string | null;
  };
};

export type TrackingSummary = {
  period: { from: string; to: string };
  totalEvents: number;
  previews: number;
  downloads: number;
  accessDenied: number;
  errors: number;
  uniqueDocuments: number;
  uniqueActors: number;
  topDocuments: Array<{ documentId: string; count: number }>;
  topDownloaders: Array<{ userId: string; displayName?: string; count: number }>;
};

export type ClientTrackingEventInput = {
  action: string;
  documentId?: string;
  versionId?: string;
  metadata?: Record<string, unknown>;
};
