import type { TenantType } from '../db/types.js';

export type DocumentAuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type DocumentAuditAction =
  | 'document.upload_started'
  | 'document.upload_completed'
  | 'document.upload_failed'
  | 'document.analysis_started'
  | 'document.analysis_completed'
  | 'document.analysis_failed'
  | 'document.review_opened'
  | 'document.review_confirmed'
  | 'document.metadata_updated'
  | 'document.filename_updated'
  | 'document.category_updated'
  | 'document.version_created'
  | 'document.preview_generated'
  | 'document.preview_failed'
  | 'document.preview_viewed'
  | 'document.downloaded'
  | 'document.archived'
  | 'document.restored'
  | 'document.deleted'
  | 'document.access_granted'
  | 'document.access_revoked'
  | 'document.shared'
  | 'document.share_revoked'
  | 'document.rule_matched'
  | 'document.rule_changed'
  | 'document.storage_promoted'
  | 'document.created'
  | 'document.metadata.confirmed'
  | 'document.metadata.reviewed_confirmed'
  | 'document.classified'
  | 'document.metadata.extracted'
  | 'document.review.required'
  | 'tenant.provision.started'
  | 'tenant.provision.collections_created'
  | 'tenant.provision.indexes_created'
  | 'tenant.provision.completed';

export const SYSTEM_DOCUMENT_AUDIT_ACTIONS = new Set<DocumentAuditAction>([
  'tenant.provision.started',
  'tenant.provision.collections_created',
  'tenant.provision.indexes_created',
  'tenant.provision.completed',
]);

export type DocumentAuditChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type DocumentAuditContext = {
  tenantId: string;
  tenantType: TenantType;
  collectionPrefix: string;
  ownerTenantId?: string;
  ownerUserId?: string;
  actorUserId: string;
  actorMembershipId?: string;
  actorRoles?: string[];
  actorAccessGroupIds?: string[];
  actorDocumentGroupIds?: string[];
  actorDisplayName?: string;
  actorEmail?: string;
  actorRole?: string;
  requestId?: string;
};

export type DocumentAuditEventInput = {
  action: DocumentAuditAction | string;
  severity?: DocumentAuditSeverity;
  description: string;
  documentId?: string | null;
  versionId?: string | null;
  uploadJobId?: string;
  analysisJobId?: string;
  area?: string;
  result?: 'success' | 'warning' | 'error' | 'info';
  target?: {
    type: 'document' | 'document_version' | 'analysis_job' | 'preview' | 'storage_object' | 'rule' | 'category';
    id?: string;
    nameSnapshot?: string;
  };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

export type DocumentTimelineItem = {
  id: string;
  action: string;
  severity: DocumentAuditSeverity;
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

export type DocumentTrackingListItem = {
  id: string;
  occurredAt: string;
  action: string;
  severity: DocumentAuditSeverity;
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
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  requestId?: string;
  durationMs?: number;
};

export const DOCUMENT_AUDIT_ACTION_LABELS: Record<string, string> = {
  'document.upload_started': 'Upload iniciado',
  'document.upload_completed': 'Upload concluído',
  'document.upload_failed': 'Falha no upload',
  'document.analysis_started': 'Análise iniciada',
  'document.analysis_completed': 'Análise concluída',
  'document.analysis_failed': 'Falha na análise',
  'document.review_confirmed': 'Revisão confirmada',
  'document.metadata_updated': 'Metadados atualizados',
  'document.filename_updated': 'Nome do arquivo atualizado',
  'document.category_updated': 'Categoria atualizada',
  'document.version_created': 'Nova versão criada',
  'document.preview_generated': 'Preview gerado',
  'document.preview_failed': 'Falha no preview',
  'document.preview_viewed': 'Preview visualizado',
  'document.downloaded': 'Download realizado',
  'document.storage_promoted': 'Arquivo promovido ao storage definitivo',
  'document.created': 'Documento criado',
  'document.metadata.confirmed': 'Metadados confirmados',
  'document.metadata.reviewed_confirmed': 'Revisão confirmada com ajustes',
};
