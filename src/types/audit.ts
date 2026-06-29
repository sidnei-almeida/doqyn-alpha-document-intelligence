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
  pendingUsersCount: number;
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
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  document_uploaded: 'Documento enviado',
  version_created: 'Nova versão criada',
  document_reviewed: 'Documento revisado',
  permission_granted: 'Permissão concedida',
  rule_applied: 'Regra aplicada',
  document_viewed: 'Documento visualizado',
  'document.created': 'Documento criado',
  'document.version.created': 'Versão criada',
  'document.classified': 'Documento classificado',
  'document.metadata.extracted': 'Metadados extraídos',
  'document.metadata.confirmed': 'Análise confirmada',
  'document.metadata.reviewed_confirmed': 'Revisão confirmada',
  'document.review.required': 'Revisão necessária',
  USER_ACCESS_REQUESTED: 'Solicitação de acesso',
  USER_INVITED: 'Usuário convidado',
  USER_CREATED: 'Usuário criado',
  USER_APPROVED: 'Acesso aprovado',
  USER_REJECTED: 'Acesso rejeitado',
  USER_BLOCKED: 'Usuário bloqueado',
  USER_ACTIVATED: 'Usuário reativado',
  USER_ACCESS_UPDATED: 'Acesso atualizado',
  NOTIFICATION_PREFERENCES_UPDATED: 'Preferências atualizadas',
};

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: 'Informação',
  success: 'Sucesso',
  warning: 'Atenção',
  error: 'Erro',
  critical: 'Crítico',
};

export const AUDIT_SOURCE_LABELS: Record<AuditSource, string> = {
  document: 'Documentos',
  user: 'Usuários',
  system: 'Sistema',
};
