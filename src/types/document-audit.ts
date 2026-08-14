export type DocumentAuditChange = {
  field: string;
  before: unknown;
  after: unknown;
};

/** Espelha `TrackingActionGroup` de `server/services/tracking/trackingTypes.ts`. */
export type DocumentTimelineActionGroup =
  | 'lifecycle'
  | 'preview'
  | 'download'
  | 'access'
  | 'storage'
  | 'governance'
  | 'explorer'
  | 'user'
  | 'system';

export type DocumentTimelineStatus = 'success' | 'failed' | 'denied' | 'pending';

export type DocumentTimelineActor = {
  userId: string;
  displayName?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

/** Espelha `DocumentTimelineContext` de `server/audit/documentAuditTypes.ts`. */
export type DocumentTimelineContext = {
  ipMasked?: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  sessionHash?: string;
  authMethod?: string;
  isExternalGuest?: boolean;
  isLocalNetwork?: boolean;
  permissionResult?: 'allowed' | 'denied';
  permissionReason?: string;
  requiredPermission?: string;
};

export type DocumentTimelineItem = {
  id: string;
  action: string;
  actionGroup: DocumentTimelineActionGroup;
  status: DocumentTimelineStatus;
  result?: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  occurredAt: string;
  summary: string;
  actor: DocumentTimelineActor;
  context?: DocumentTimelineContext;
  documentId?: string | null;
  versionId?: string | null;
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  requestId?: string;
};

/** Filtros aceitos por `GET /api/documents/:id/timeline`. */
export type DocumentTimelineFilters = {
  actionPrefix?: string;
  actionGroup?: DocumentTimelineActionGroup;
  status?: DocumentTimelineStatus;
  actorUserId?: string;
  /** ISO 8601. */
  from?: string;
  /** ISO 8601. */
  to?: string;
  cursor?: string;
  limit?: string;
};

export type DocumentTimelineResponse = {
  items: DocumentTimelineItem[];
  pagination: {
    nextCursor: string | null;
  };
};
