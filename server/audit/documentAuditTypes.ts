import type { TenantType } from '../db/types.js';
import type { TrackingActionGroup } from '../services/tracking/trackingTypes.js';

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
  | 'document.download_failed'
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
  | 'document.deactivated'
  | 'document.reactivated'
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
  /** Início da requisição em epoch ms — origem do `durationMs` da trilha. */
  startedAt?: number;
  /** Idioma de quem age: é nele que a frase do evento fica gravada. Ausente, pt-BR. */
  actorLocale?: string;
};

export type DocumentAuditEventInput = {
  action: DocumentAuditAction | string;
  severity?: DocumentAuditSeverity;
  /**
   * Frase pronta. **Evento novo não passa**: sem ela, a frase sai do catálogo `auditEvents` pela
   * ação, no idioma do ator, e o evento grava `params` para ser relido em qualquer idioma.
   */
  description?: string;
  /** Valores da frase e a variante (`context`). Passam por `sanitizeAuditMetadata`. */
  params?: Record<string, string | number | boolean>;
  documentId?: string | null;
  versionId?: string | null;
  uploadJobId?: string;
  analysisJobId?: string;
  area?: string;
  result?: 'success' | 'warning' | 'error' | 'info';
  target?: {
    type:
      | 'document'
      | 'document_version'
      | 'analysis_job'
      | 'preview'
      | 'storage_object'
      | 'rule'
      | 'category';
    id?: string;
    nameSnapshot?: string;
  };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: DocumentAuditChange[];
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

export type DocumentTimelineActor = {
  userId: string;
  displayName?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

/**
 * Recorte do `securityContext` que a trilha do documento expõe com contrato próprio, em vez de
 * despejar tudo dentro de `metadata` — quem consome não deveria precisar adivinhar o que existe lá.
 * O IP completo nunca entra aqui: só a máscara, como o `TrackingSecurityContext` já garante.
 */
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
  /** Carimbo de `emitTrackingEvent` quando existe; derivado da action quando não existe. */
  actionGroup: TrackingActionGroup;
  /** Idem: carimbo quando existe, derivação de action/result quando não. */
  status: TrackingListStatus;
  result?: string;
  severity: DocumentAuditSeverity;
  occurredAt: string;
  summary: string;
  /** Presente só em evento gravado pelo catálogo; é o sinal de que a frase pode ser relida. */
  params?: Record<string, string | number | boolean>;
  actor: DocumentTimelineActor;
  context?: DocumentTimelineContext;
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
  params?: Record<string, string | number | boolean>;
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
  /* A lista é o log: o que se lê na linha viaja com ela. Metadado cru, diff e
     contexto completo continuam só no detalhe. */
  requestId?: string;
  durationMs?: number;
  changesCount?: number;
  security?: Record<string, unknown>;
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
