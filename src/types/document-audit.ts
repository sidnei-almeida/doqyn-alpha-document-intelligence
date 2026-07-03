export type DocumentAuditChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type DocumentTimelineItem = {
  id: string;
  action: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  occurredAt: string;
  summary: string;
  actor: {
    userId: string;
    displayName?: string;
    email?: string;
  };
  documentId?: string | null;
  versionId?: string | null;
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  requestId?: string;
};

export type DocumentTimelineResponse = {
  items: DocumentTimelineItem[];
  pagination: {
    nextCursor: string | null;
  };
};
