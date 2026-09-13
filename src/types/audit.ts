export type AuditAction =
  | 'document_uploaded'
  | 'version_created'
  | 'document_reviewed'
  | 'permission_granted'
  | 'rule_applied'
  | 'document_viewed'
  | 'document.created'
  | 'document.version.created'
  | 'document.classified'
  | 'document.metadata.extracted'
  | 'document.metadata.confirmed'
  | 'document.metadata.reviewed_confirmed'
  | 'document.review.required'
  | 'USER_ACCESS_REQUESTED'
  | 'USER_INVITED'
  | 'USER_CREATED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_BLOCKED'
  | 'USER_ACTIVATED'
  | 'USER_ACCESS_UPDATED'
  | 'NOTIFICATION_PREFERENCES_UPDATED'
  | string;

export type AuditResult = 'success' | 'warning' | 'error' | 'info';

export type AuditSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';

export type AuditSource = 'document' | 'user' | 'system';

export interface AuditEvent {
  id: string;
  tenantId: string;
  documentId?: string | null;
  actorUserId?: string;
  actorName?: string;
  action: AuditAction;
  description: string;
  /** Presente só em evento gravado pelo catálogo `auditEvents`. */
  params?: Record<string, string | number | boolean>;
  area?: string;
  result?: AuditResult;
  severity: AuditSeverity;
  source: AuditSource;
  createdAt: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export interface AuditOverview {
  pendingCount: number;
  todayEventsCount: number;
  criticalEventsCount: number;
  totalEventsCount?: number;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  total: number;
  nextCursor: string | null;
}

export type AuditEventFilters = {
  q?: string;
  type?: string;
  severity?: AuditSeverity | '';
  actorId?: string;
  from?: string;
  to?: string;
  documentId?: string;
  limit?: number;
  cursor?: string;
  category?: 'security';
};

/**
 * Chaves do catálogo `audit`, com namespace explícito para resolver em qualquer `t`.
 *
 * O id da ação vem do servidor e às vezes tem ponto (`document.created`); a chave do catálogo não
 * pode ter, porque ponto é separador de caminho. Ação sem entrada aqui aparece com o id cru.
 */
export const AUDIT_ACTION_LABEL_KEYS: Record<string, string> = {
  document_uploaded: 'audit:action.documentUploaded',
  version_created: 'audit:action.versionCreated',
  document_reviewed: 'audit:action.documentReviewed',
  permission_granted: 'audit:action.permissionGranted',
  rule_applied: 'audit:action.ruleApplied',
  document_viewed: 'audit:action.documentViewed',
  'document.created': 'audit:action.documentCreated',
  'document.version.created': 'audit:action.documentVersionCreated',
  'document.classified': 'audit:action.documentClassified',
  'document.metadata.extracted': 'audit:action.metadataExtracted',
  'document.metadata.confirmed': 'audit:action.metadataConfirmed',
  'document.metadata.reviewed_confirmed': 'audit:action.reviewConfirmed',
  'document.review.required': 'audit:action.reviewRequired',
  USER_ACCESS_REQUESTED: 'audit:action.userAccessRequested',
  USER_INVITED: 'audit:action.userInvited',
  USER_CREATED: 'audit:action.userCreated',
  USER_APPROVED: 'audit:action.userApproved',
  USER_REJECTED: 'audit:action.userRejected',
  USER_BLOCKED: 'audit:action.userBlocked',
  USER_ACTIVATED: 'audit:action.userActivated',
  USER_ACCESS_UPDATED: 'audit:action.userAccessUpdated',
  NOTIFICATION_PREFERENCES_UPDATED: 'audit:action.notificationPreferencesUpdated',
};

export const AUDIT_SEVERITY_LABEL_KEYS: Record<AuditSeverity, string> = {
  info: 'audit:severity.info',
  success: 'audit:severity.success',
  warning: 'audit:severity.warning',
  error: 'audit:severity.error',
  critical: 'audit:severity.critical',
};

export const AUDIT_SOURCE_LABEL_KEYS: Record<AuditSource, string> = {
  document: 'audit:source.document',
  user: 'audit:source.user',
  system: 'audit:source.system',
};
