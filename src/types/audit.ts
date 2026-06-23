export type AuditAction =
  | 'document_uploaded'
  | 'version_created'
  | 'document_reviewed'
  | 'permission_granted'
  | 'rule_applied'
  | 'document_viewed';

export type AuditResult = 'success' | 'warning' | 'error' | 'info';

export interface AuditEvent {
  id: string;
  tenantId: string;
  documentId: string;
  actorUserId: string;
  actorName: string;
  action: AuditAction;
  description: string;
  area: string;
  result: AuditResult;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  document_uploaded: 'Documento enviado',
  version_created: 'Nova versão criada',
  document_reviewed: 'Documento revisado',
  permission_granted: 'Permissão concedida',
  rule_applied: 'Regra aplicada',
  document_viewed: 'Documento visualizado',
};
