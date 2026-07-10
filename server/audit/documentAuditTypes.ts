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
  | 'document.moved'
  | 'document.share_created'
  | 'document.share_revoked'
  | 'document.external_share_created'
  | 'document.external_share_invite_opened'
  | 'document.external_share_accepted'
  | 'document.external_share_viewed'
  | 'document.external_share_downloaded'
  | 'document.external_share_revoked'
  | 'document.external_share_expired'
  | 'document.external_share_denied'
  | 'document.shared_viewed'
  | 'document.shared_downloaded'
  | 'document.share_denied'
  | 'document.version_created'
  | 'document.ownership_transferred'
  | 'document.preview_generated'
  | 'document.preview_failed'
  | 'document.preview_viewed'
  | 'document.preview_denied'
  | 'document.viewer_opened'
  | 'document.viewer_closed'
  | 'document.print_attempt_blocked'
  | 'document.download_attempted'
  | 'document.downloaded'
  | 'document.download_denied'
  | 'access.document_denied'
  | 'access.document_allowed'
  | 'access.permission_missing'
  | 'file_explorer.folder_opened'
  | 'file_explorer.search_performed'
  | 'file_explorer.filter_applied'
  | 'file_explorer.details_opened'
  | 'document.archived'
  | 'document.restored'
  | 'document.deleted'
  | 'document.trash_moved'
  | 'document.trash_restored'
  | 'document.permanent_deleted'
  | 'document.trash_purge_failed'
  | 'document.signature_request_created'
  | 'document.signature_internal_assigned'
  | 'document.signature_internal_opened'
  | 'document.signature_external_invite_created'
  | 'document.signature_external_opened'
  | 'document.signature_link_opened'
  | 'document.signature_preview_viewed'
  | 'document.signature_viewed'
  | 'document.signature_consent_checked'
  | 'document.signature_completed'
  | 'document.signature_declined'
  | 'document.signature_request_cancelled'
  | 'document.signature_expired'
  | 'document.signed_pdf_generated'
  | 'document.signature_verification_opened'
  | 'document.signature_downloaded'
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
  status?: TrackingListStatus;
  actionGroup?: string;
  result?: string;
  sessionHash?: string;
};

export type TrackingListStatus = 'success' | 'failed' | 'denied' | 'pending';

export type DocumentTrackingDetail = DocumentTrackingListItem & {
  tenantId: string;
  description: string;
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  requestId?: string;
  durationMs?: number;
  security?: Record<string, unknown>;
  securityContext?: Record<string, unknown>;
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
  'document.moved': 'Documento movido de categoria',
  'document.share_created': 'Compartilhamento criado',
  'document.share_revoked': 'Compartilhamento revogado',
  'document.shared_viewed': 'Documento compartilhado visualizado',
  'document.shared_downloaded': 'Download de documento compartilhado',
  'document.share_denied': 'Compartilhamento negado',
  'document.version_created': 'Nova versão criada',
  'document.ownership_transferred': 'Propriedade transferida',
  'document.preview_generated': 'Preview gerado',
  'document.preview_failed': 'Falha no preview',
  'document.preview_viewed': 'Preview visualizado',
  'document.preview_denied': 'Preview negado',
  'document.viewer_opened': 'Viewer aberto',
  'document.viewer_closed': 'Viewer fechado',
  'document.print_attempt_blocked': 'Impressão bloqueada',
  'document.download_attempted': 'Download tentado',
  'document.downloaded': 'Download realizado',
  'document.download_denied': 'Download negado',
  'access.document_denied': 'Acesso negado',
  'access.document_allowed': 'Acesso permitido',
  'file_explorer.folder_opened': 'Pasta aberta',
  'file_explorer.search_performed': 'Busca realizada',
  'file_explorer.filter_applied': 'Filtro aplicado',
  'file_explorer.details_opened': 'Detalhes abertos',
  'document.storage_promoted': 'Arquivo promovido ao storage definitivo',
  'document.trash_moved': 'Documento movido para a lixeira',
  'document.trash_restored': 'Documento restaurado da lixeira',
  'document.permanent_deleted': 'Documento excluído permanentemente',
  'document.trash_purge_failed': 'Falha na purga de storage',
  'document.signature_request_created': 'Solicitação de assinatura criada',
  'document.signature_internal_assigned': 'Assinatura atribuída a usuário interno',
  'document.signature_internal_opened': 'Assinatura interna aberta',
  'document.signature_external_invite_created': 'Convite externo de assinatura criado',
  'document.signature_external_opened': 'Assinatura externa aberta',
  'document.signature_link_opened': 'Link de assinatura aberto',
  'document.signature_preview_viewed': 'Preview para assinatura visualizado',
  'document.signature_viewed': 'Documento para assinatura visualizado',
  'document.signature_consent_checked': 'Aceite de assinatura registrado',
  'document.signature_completed': 'Assinatura eletrônica concluída',
  'document.signature_declined': 'Assinatura recusada',
  'document.signature_request_cancelled': 'Solicitação de assinatura revogada',
  'document.signature_expired': 'Solicitação de assinatura expirada',
  'document.signed_pdf_generated': 'PDF assinado gerado',
  'document.signature_verification_opened': 'Validação de assinatura aberta',
  'document.signature_downloaded': 'PDF assinado baixado',
  'document.created': 'Documento criado',
  'document.metadata.confirmed': 'Metadados confirmados',
  'document.metadata.reviewed_confirmed': 'Revisão confirmada com ajustes',
};
