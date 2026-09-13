import type { GovernancePermissionValue } from '../../shared/governancePermissions.js';
import type { TenantUploadPolicy } from '../../shared/uploadPolicy.js';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationStatus,
  NotificationType,
} from './notificationTypes.js';

export type StoragePlaceholderStatus = 'pending' | 'stored' | 'failed' | 'skipped';

export type TenantType = 'individual' | 'business';
export type TaxIdType = 'CPF' | 'CNPJ';
export type TenantStatus = 'pending' | 'active' | 'inactive' | 'blocked';
export type TenantIsolationStrategy = 'shared_individual_pool' | 'collection_prefix';

export type MongoTenantStorageStatus = 'pending' | 'ready' | 'failed';

export type MongoTenantStorage = {
  provider: 'cloudflare_r2';
  mode: 'per_tenant' | 'shared';
  bucketName: string;
  bucketAlias: string;
  bucketSlug?: string;
  shortHash?: string;
  bucketStatus: MongoTenantStorageStatus;
  bucketCreatedAt?: Date;
  bucketLastCheckedAt?: Date;
  bucketProvisionError?: string;
  /**
   * Estado da política de CORS do bucket, separado de `bucketStatus` de propósito: bucket que
   * existe mas não aceita `PUT` do navegador é indistinguível de bucket pronto pelo lado do
   * servidor, e o upload falha só no cliente.
   */
  corsStatus?: MongoTenantStorageStatus;
  corsPolicyHash?: string;
  corsVerifiedAt?: Date;
  corsError?: string;
};

export type TrashRetentionMode = 'days' | 'manual';

export type MongoTenantTrashSettings = {
  trashRetentionMode: TrashRetentionMode;
  trashRetentionDays: number;
};

export type MongoTenantSettings = {
  trash?: MongoTenantTrashSettings;
  /** Política de upload/IA da organização (formato em `shared/uploadPolicy.ts`). */
  uploadPolicy?: TenantUploadPolicy;
};

export type MongoTenantQuotas = {
  analysisPerDay?: number;
  uploadsPerHour?: number;
};

export type MongoTenant = {
  _id: string;
  tenantId: string;
  tenantType: TenantType;
  taxIdType: TaxIdType;
  taxIdMasked: string;
  taxIdHash: string;
  displayName: string;
  legalName?: string;
  slug: string;
  status: TenantStatus;
  isolation: {
    strategy: TenantIsolationStrategy;
    collectionPrefix: string;
    /**
     * Gravado por tenantProvisionService (`isolation.storageMode`).
     * Fonte de verdade do tipo: `TenantStorageMode` em `server/tenancy/tenantStorage.ts`
     * — repetido inline aqui porque aquele módulo já importa `MongoTenant` deste,
     * e importar de volta fecharia um ciclo neste módulo de tipos folha.
     */
    storageMode?: 'shared_collections' | 'shared_individual_collection';
  };
  storage?: MongoTenantStorage;
  settings?: MongoTenantSettings;
  quotas?: MongoTenantQuotas;
  createdAt: Date;
  updatedAt: Date;
  /** @deprecated alias de tenantId */
  companyId?: string;
};

export type TenantMemberStatus = 'pending' | 'active' | 'blocked' | 'rejected';

export type MongoTenantMember = {
  _id: string;
  memberId: string;
  tenantId: string;
  /** UUID do usuário no doqyn-auth-service (`auth_users.id`). */
  authUserId?: string;
  /**
   * Legado, e **não é o apelido**: guarda o e-mail (ver `tenantMemberSyncService`).
   *
   * O nome do campo é anterior ao handle público, que vive em `auth_users.username`. Tratá-lo
   * como apelido exibe `@fulano@empresa.com` para o usuário.
   */
  username?: string;
  email: string;
  emailNormalized: string;
  firstName?: string;
  lastName?: string;
  whatsapp?: string;
  whatsappNormalized?: string;
  status: TenantMemberStatus;
  tenantRoles: PlatformRole[];
  accessGroupIds: string[];
  requestedAccess?: TenantMemberRequestedAccess;
  approvedAccess?: TenantMemberApprovedAccess;
  notificationPreferences?: NotificationPreferences;
  consent?: MemberConsent;
  requestedTenantId?: string;
  invitedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectedReason?: string;
  blockedBy?: string;
  blockedAt?: Date;
  accessRequestMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  /** @deprecated alias de tenantId */
  companyId?: string;
};

export type MongoAccessGroup = {
  _id: string;
  tenantId: string;
  /** @deprecated Use tenantId */
  companyId: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformRole = 'company_admin' | 'individual_admin' | 'user';

export type AccessRequestSource = 'public_form' | 'admin_invite' | 'migration' | 'manual_seed';

export type TenantMemberRequestedAccess = {
  personType?: TenantType;
  taxIdType?: TaxIdType;
  taxIdMasked?: string;
  taxIdHash?: string;
  tenantId?: string;
  tenantDisplayName?: string;
  jobTitle?: string;
  departmentText?: string;
  reason?: string;
  requestedAt: Date;
  source: AccessRequestSource;
};

export type TenantMemberApprovedAccess = {
  tenantRoles: PlatformRole[];
  accessGroupIds: string[];
  approvedBy?: string;
  approvedAt?: Date;
};

export type NotificationPreferences = {
  email: boolean;
  whatsapp: boolean;
  documentCreated: boolean;
  documentUpdated: boolean;
  documentRequiresSignature: boolean;
  documentShared: boolean;
  accessApproved: boolean;
  accessRejected: boolean;
};

export type MemberConsent = {
  operationalNotifications: boolean;
  acceptedAt?: Date;
  consentTextVersion?: string;
};

export const CONSENT_TEXT_VERSION = 'operational-notifications-v1';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  whatsapp: true,
  documentCreated: true,
  documentUpdated: true,
  documentRequiresSignature: true,
  documentShared: true,
  accessApproved: true,
  accessRejected: true,
};

export type CompanyMemberStatus = 'pending' | 'active' | 'blocked' | 'rejected';

export type MongoCompany = {
  _id: string;
  tenantId: string;
  companyId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
};

export type MongoCompanyMember = {
  _id: string;
  tenantId: string;
  companyId: string;
  userId: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  authUserId?: string;
  position?: string;
  /** Legado — preferir platformRoles em fluxos novos. */
  role: 'admin' | 'manager' | 'member' | 'auditor';
  platformRoles?: PlatformRole[];
  status: CompanyMemberStatus;
  /** Legado — mesmo valor que accessGroupIds. */
  groupIds: string[];
  accessGroupIds?: string[];
  requestedCompanyId?: string;
  requestedRoles?: PlatformRole[];
  invitedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  blockedBy?: string;
  blockedAt?: Date;
  accessRequestMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoDocumentClassPermissions = {
  view: string[];
  download: string[];
  update: string[];
  audit: string[];
  share: string[];
};

export type MongoDocumentClass = {
  _id: string;
  tenantId: string;
  companyId: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  iconKey: string;
  color: string;
  keywords: string[];
  negativeKeywords?: string[];
  permissions: MongoDocumentClassPermissions;
  notifyOnUpdate: boolean;
  notifyGroups: string[];
  scope?: 'global' | 'tenant';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoRuleField = {
  key: string;
  label: string;
  type: 'string' | 'date' | 'currency' | 'number' | 'boolean';
  required: boolean;
  aliases?: string[];
  description?: string;
  examples?: string[];
};

export type MongoDocumentRule = {
  _id: string;
  tenantId: string;
  companyId: string;
  classId: string;
  version: number;
  active: boolean;
  fields: MongoRuleField[];
  namingTemplate: string;
  minimumConfidence: number;
  onLowConfidence: 'requires_review';
  scope?: 'global' | 'tenant';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Categoria/tipo documental para classificação IA e governança. */
export type MongoDocumentCategory = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: 'business' | 'individual';
  ownerTenantId?: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  keywords: string[];
  negativeKeywords?: string[];
  examples?: string[];
  iconKey?: string;
  color?: string;
  sortOrder?: number;
  notifyOnUpdate?: boolean;
  notifyGroups?: string[];
  scope?: 'global' | 'tenant';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Grupo documental (membros + permissões sobre categorias). */
export type MongoDocumentGroup = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: 'business' | 'individual';
  ownerTenantId?: string;
  name: string;
  slug: string;
  description: string;
  /** Chave da paleta (`shared/groupPalette.ts`), não hexadecimal. */
  color?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  scope?: 'global' | 'tenant';
};

export type MongoDocumentGroupMember = {
  _id: string;
  tenantId: string;
  companyId: string;
  groupId: string;
  membershipId: string;
  userId: string;
  displayName?: string;
  email?: string;
  active: boolean;
  addedBy: string;
  addedAt: Date;
  scope?: 'global' | 'tenant';
  /**
   * Quem desativou o vínculo. Presente só quando foi o sync, ao ver o membro sair de ativo — e é
   * o que distingue o vínculo que ele pode restaurar do que um administrador tirou à mão.
   */
  deactivatedBy?: 'member_status';
  deactivatedAt?: Date;
};

/**
 * Permissões de uma regra grupo × categoria.
 *
 * Os campos guardam `boolean | 'require'`. `true`/`false` são o formato antigo e continuam
 * válidos — não há migração. Nunca ler pelo valor cru: `if (permissions.share)` trataria
 * `'require'` como liberado. Usar `toPermissionState` de `shared/governancePermissions.ts`.
 *
 * Os nomes `upload` e `manage` são herança do primeiro desenho e alimentam os verbos `update` e
 * `audit`. Renomear exigiria migração de dados por ganho cosmético; a tradução vive em
 * `server/tenancy/governanceAccessIndex.ts`.
 */
export type MongoDocumentAccessPermissions = {
  view: GovernancePermissionValue;
  download: GovernancePermissionValue;
  upload: GovernancePermissionValue;
  share: GovernancePermissionValue;
  manage: GovernancePermissionValue;
};

/** Regra de acesso: grupo × categoria. */
export type MongoDocumentAccessRule = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: 'business' | 'individual';
  ownerTenantId?: string;
  groupId: string;
  categoryId: string;
  permissions: MongoDocumentAccessPermissions;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  scope?: 'global' | 'tenant';
};

/**
 * Configuração de alerta de vencimento, por categoria.
 *
 * A data observada é `documents.searchMeta.validityDate`, que já é derivada dos campos de
 * vencimento/validade da extração (ver `projectSearchMeta`) e pode ser corrigida à mão pelo
 * usuário quando a IA não conseguir extrair.
 */
export type MongoDocumentExpiryAlertConfig = {
  enabled: boolean;
  /**
   * Marcos de antecedência, em dias. `0` é o próprio dia do vencimento; negativos avisam depois
   * de vencido. Um alerta por marco, sem repetição.
   */
  offsetsDays: number[];
  /** Grupos documentais que recebem o alerta. Vazio = ninguém é avisado. */
  notifyGroupIds: string[];
  /** Continuar avisando depois de vencido, nos marcos negativos configurados. */
  notifyAfterExpiry: boolean;
};

/** Regra de extração IA vinculada a uma categoria. */
export type MongoDocumentExtractionRule = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: 'business' | 'individual';
  ownerTenantId?: string;
  categoryId: string;
  /** @deprecated alias de categoryId */
  classId?: string;
  version: number;
  active: boolean;
  fields: MongoRuleField[];
  namingTemplate: string;
  minimumConfidence: number;
  onLowConfidence: 'requires_review';
  expiryAlerts?: MongoDocumentExpiryAlertConfig;
  scope?: 'global' | 'tenant';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Uma notificação entregue a um usuário.
 *
 * Generaliza o alerta de vencimento: o vencimento virou um `type` entre outros, com o que era
 * específico dele (marco, data, dias restantes) recolhido em `expiry`. Um registro por
 * (tenant, usuário, tipo, `eventKey`) — a chave única é o que impede o mesmo fato de chegar duas
 * vezes quando a emissão é reprocessada.
 */
export type MongoNotification = {
  _id: string;
  tenantId: string;
  companyId: string;
  type: NotificationType;
  /** Destinatário. */
  userId: string;
  /**
   * Identidade do fato que originou a notificação, dentro do tipo. Vencimento usa
   * `${documentId}:${offsetDays}`; documento criado usa o id da versão; decisão de acesso usa o id
   * do membro mais a decisão.
   */
  eventKey: string;
  /**
   * Texto pronto, no idioma padrão do servidor. É o que o e-mail usa e o que a tela mostra quando
   * a notificação não tem `params` (gravada antes do catálogo).
   */
  title: string;
  body?: string;
  /**
   * Os valores que montam título e corpo pelo catálogo `notifications:inApp.<type>` — a tela relê
   * no idioma de quem abre. Ver `shared/notificationText.ts`.
   */
  params?: Record<string, string | number | boolean>;
  documentId?: string;
  documentName?: string;
  categoryId?: string;
  categoryName?: string;
  /** Quem causou o fato. Nunca é o próprio destinatário. */
  actorUserId?: string;
  actorName?: string;
  /** Só em `document_expiring`. */
  expiry?: {
    offsetDays: number;
    validityDate: Date;
    daysRemaining: number;
  };
  status: NotificationStatus;
  createdAt: Date;
  readAt?: Date | null;
};

/**
 * Uma tentativa de entrega, por canal.
 *
 * O canal `in_app` nasce entregue — a notificação já está na caixa do usuário. `email` e
 * `whatsapp` gravam a intenção e param em `skipped_no_provider` enquanto não há provedor. É o
 * registro que permite ligar SMTP ou Meta API depois sem reescrever quem emite.
 */
export type MongoNotificationDelivery = {
  _id: string;
  tenantId: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  /** Por que foi pulada ou falhou. Vazio quando entregue. */
  reason?: string;
  createdAt: Date;
  deliveredAt?: Date | null;
  /** Quantas vezes o envio já foi tentado. Só canais externos usam. */
  attempts?: number;
  /** Quando a próxima tentativa pode acontecer — o espaçamento cresce a cada falha. */
  nextAttemptAt?: Date | null;
  /** Quando um drenador travou esta linha. A trava vence sozinha se o processo morrer. */
  lockedAt?: Date | null;
  /** O id que o provedor devolveu, para rastrear a entrega do lado dele. */
  providerMessageId?: string | null;
};

export type MongoStorageSlot = {
  provider: 'aws_s3' | 'cloudflare_r2' | 'local';
  status: StoragePlaceholderStatus;
  objectKey: string | null;
  bucketAlias: string | null;
  storedAt: Date | null;
};

export type MongoPreviewStorageStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';

export type MongoPreviewStorageSlot = {
  provider: 'aws_s3' | 'cloudflare_r2' | 'local';
  status: MongoPreviewStorageStatus;
  bucketAlias: string | null;
  objectKey: string | null;
  contentType?: string;
  sizeBytes?: number | null;
  generatedAt?: Date | null;
  sourceVersionId?: string | null;
  watermark?: {
    type: 'text' | 'logo';
    value: string;
  };
  optimization?: {
    engine: 'ghostscript';
    profile: string;
    originalSizeBytes: number;
    previewSizeBytes: number;
    compressionRatio: number;
  };
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type MongoPreviewManifestPage = {
  page: number;
  width: number;
  height: number;
  rotation?: number;
  aspectRatio?: number;
  previewObjectKey?: string;
  thumbnailObjectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailSizeBytes?: number;
  status?: 'ready' | 'pending' | 'failed';
  generatedAt?: Date;
};

export type MongoPreviewManifestImage = {
  width: number;
  height: number;
  aspectRatio?: number;
  resolutions?: Array<{
    label: string;
    width: number;
    height?: number;
    objectKey?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
};

export type MongoPreviewManifest = {
  viewerType: 'pdf_pages' | 'image' | 'unsupported';
  mimeType: string;
  source?: 'preview_pdf' | 'preview_image';
  status?: 'ready' | 'processing' | 'failed';
  pageCount?: number;
  pages?: MongoPreviewManifestPage[];
  image?: MongoPreviewManifestImage;
  generatedAt?: Date;
};

export type MongoMetadataIndexEntry = {
  key: string;
  type: 'string' | 'number' | 'date';
  valueString?: string;
  valueNumber?: number;
  valueDate?: Date;
};

export type MongoVersionMetadataField = {
  label: string;
  value: string | number | null;
  normalizedValue?: string | number | null;
  confidence: number;
  source: 'ai' | 'document_text' | 'manual';
  page?: number;
  currency?: string;
  evidence?: {
    pageNumber?: number;
    snippet: string;
  };
};

/** Pessoa isolada p/ busca direcionada (não substitui versions.metadata). */
export type MongoDocumentPersonMeta = {
  name: string;
  nameNormalized: string;
  /** Papel / relação: mae, pai, responsavel, parte_receptora, fornecedor, … */
  role: string;
  /** Nome da pessoa relacionada (ex.: mãe → filho), quando inferível. */
  relatedTo?: string;
  sourceKey: string;
};

/** Data isolada p/ busca/filtro sem varrer o blob de metadados. */
export type MongoDocumentDateMeta = {
  kind: string;
  date: Date;
  sourceKey: string;
  label?: string;
};

/**
 * Projeção indexável no documento (1º nível).
 * Mantém extras ricos em document_versions.metadata.
 */
export type MongoDocumentSearchMeta = {
  people: MongoDocumentPersonMeta[];
  dates: MongoDocumentDateMeta[];
  /** Título extraído (ex.: campo titulo), distinto do filename. */
  documentTitle?: string | null;
  /** Vencimento/validade tipado (data absoluta ou inferida de âncora + prazo). */
  validityDate?: Date | null;
};

export type DocumentLifecycleStatus =
  | 'active'
  | 'trashed'
  | 'deactivated'
  | 'purged'
  | 'permanently_deleted';

export type DocumentPurgeStatus = 'pending' | 'completed' | 'failed';

export type MongoDocument = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: TenantType;
  ownerTenantId?: string;
  ownerUserId?: string;
  documentCode: string;
  currentVersionId: string;
  currentVersionLabel?: string;
  versionCount?: number;
  classId: string;
  className: string;
  title: string;
  currentFileName: string;
  status: 'active' | 'archived';
  lifecycleStatus?: DocumentLifecycleStatus;
  processingStatus: 'processed' | 'requires_review' | 'processed_with_review' | 'pending';
  access: {
    viewGroupIds: string[];
    downloadGroupIds: string[];
    updateGroupIds: string[];
    auditGroupIds: string[];
    shareGroupIds: string[];
  };
  currentMetadataPreview?: Record<string, string | number | null>;
  /** Nomes, datas e validade isolados para busca performática. */
  searchMeta?: MongoDocumentSearchMeta;
  /** Nome exibido do proprietário original (imutável exceto transferência). */
  ownerName?: string;
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
  trashExpiresAt?: Date | null;
  /** Após TTL da lixeira — soft-desativado; storage/Mongo permanecem. */
  deactivatedAt?: Date | null;
  deactivatedBy?: string | null;
  deactivatedReason?: string | null;
  permanentlyDeletedAt?: Date | null;
  purgeStatus?: DocumentPurgeStatus | null;
  /** Categoria anterior após movimentação manual entre pastas inteligentes. */
  previousClassId?: string | null;
  previousCategoryName?: string | null;
  lastClassificationSource?: 'ai' | 'manual' | 'manual_move' | string;
  lastManualCategoryId?: string | null;
  classificationSource?: 'ai' | 'manual' | string;
  /** Status agregado de assinatura eletrônica DOQYN na versão atual. */
  signatureStatus?: DocumentSignatureStatusLabel;
  aiSuggestedClassId?: string | null;
  manualClassificationOverride?: boolean;
  manualClassificationUpdatedAt?: Date | null;
  manualClassificationUpdatedBy?: string | null;
  movedAt?: Date | null;
  movedBy?: string | null;
  categorySlug?: string | null;
};

export type MongoDocumentVersion = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: TenantType;
  ownerTenantId?: string;
  ownerUserId?: string;
  documentId: string;
  versionNumber: number;
  versionLabel: string;
  previousVersionId: string | null;
  originalFileName: string;
  recommendedFileName: string;
  aiSuggestedFileName?: string;
  selectedFileName?: string;
  finalFileName: string;
  namingMode?: 'ai_suggested' | 'original' | 'manual';
  storageFileName?: string;
  previewStorageFileName?: string;
  file: {
    mimeType: string;
    extension: string;
    sizeBytes: number;
    sha256: string;
    pageCount?: number;
  };
  classification: {
    classId: string;
    className: string;
    confidence: number;
    requiresReview: boolean;
    reason: string;
    evidence?: Array<{ pageNumber?: number; snippet: string }>;
  };
  rule: {
    ruleId: string;
    ruleVersion: number;
  };
  metadata: Record<string, MongoVersionMetadataField>;
  /** @deprecated Preferir documents.searchMeta — não é mais preenchido. */
  metadataIndex?: MongoMetadataIndexEntry[];
  storage: {
    primary: MongoStorageSlot;
    backup: MongoStorageSlot;
    preview?: MongoPreviewStorageSlot;
  };
  previewManifest?: MongoPreviewManifest;
  review: {
    required: boolean;
    reasons: string[];
    reviewedBy: string | null;
    reviewedAt: Date | null;
  };
  createdBy: string;
  createdAt: Date;
};

export type MongoDocumentChunk = {
  _id: string;
  tenantId: string;
  companyId: string;
  tenantType?: TenantType;
  ownerTenantId?: string;
  ownerUserId?: string;
  documentId: string;
  versionId: string;
  versionLabel: string;
  isCurrentVersion: boolean;
  categoryId: string;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  charStart?: number;
  charEnd?: number;
  /** Reservado para busca vetorial futura (Atlas/FAISS). */
  embedding?: number[] | null;
  createdAt: Date;
};

export type MongoProcessingJob = {
  _id: string;
  tenantId: string;
  companyId: string;
  documentId: string;
  versionId: string;
  type: 'pdf_analysis';
  status: 'completed' | 'failed' | 'requires_review';
  steps: Array<{
    key: string;
    label: string;
    status: 'done' | 'error' | 'pending';
    createdAt: Date;
  }>;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
};

export type UserAuditAction =
  | 'USER_ACCESS_REQUESTED'
  | 'USER_INVITED'
  | 'USER_CREATED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_BLOCKED'
  | 'USER_ACTIVATED'
  | 'USER_ACCESS_UPDATED'
  | 'KEYCLOAK_USER_CREATED'
  | 'KEYCLOAK_USER_DISABLED'
  | 'KEYCLOAK_ROLE_ASSIGNED'
  | 'NOTIFICATION_PREFERENCES_UPDATED';

export type MongoAuditLog = {
  _id: string;
  tenantId: string;
  companyId: string;
  documentId?: string | null;
  versionId?: string | null;
  actor: {
    userId: string;
    name: string;
    role: string;
    membershipId?: string;
    roles?: string[];
    accessGroupIds?: string[];
    documentGroupIds?: string[];
    displayNameSnapshot?: string;
    emailSnapshot?: string;
  };
  action:
    | UserAuditAction
    | 'document.created'
    | 'document.version.created'
    | 'document.classified'
    | 'document.metadata.extracted'
    | 'document.metadata.confirmed'
    | 'document.metadata.reviewed_confirmed'
    | 'document.review.required'
    | string;
  /**
   * A frase no idioma de quem agiu, no momento do evento — o registro literal, e o que a cadeia de
   * integridade assina. Não foi renomeada para `descriptionSnapshot`: o hash v3 lê este campo, e
   * trocá-lo de nome invalidaria a verificação de todo evento já gravado.
   */
  description: string;
  /**
   * Os valores da frase, para relê-la em outro idioma. Só existe em evento gravado pelo catálogo
   * `auditEvents`; evento antigo não tem, e a tela mostra a `description`. Fica fora do hash: a
   * frase assinada é a gravada, e isto é o que permite apresentá-la.
   */
  params?: Record<string, string | number | boolean>;
  area?: string;
  result?: 'success' | 'warning' | 'error' | 'info' | string;
  metadata: Record<string, unknown>;
  requestId?: string;
  severity?: string;
  occurredAt?: Date;
  collectionPrefix?: string;
  createdAt: Date;
};

/** Preferência pessoal de favorito — escopo global por userId, não por tenant. */
export type DocumentUploadApprovalStatus = 'pending' | 'approved' | 'rejected';

export type MongoDocumentUploadApproval = {
  _id: string;
  tenantId: string;
  status: DocumentUploadApprovalStatus;
  submittedBy: {
    userId: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  payload: Record<string, unknown>;
  originalFileName: string;
  classId: string | null;
  className: string | null;
  fileHash: string;
  jobId?: string;
  documentId?: string;
  versionId?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * O que se pede. Hoje só o envio de documento, que já era aprovável por outro caminho.
 *
 * Cresce com os verbos da governança: quando a Matriz ganhar o terceiro estado, cada verbo que
 * cair em "pode, pedindo" cria um pedido deste mesmo formato.
 */
export type ApprovalRequestKind = 'document_upload' | 'document_download' | 'document_share';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Um pedido esperando decisão do administrador do tenant.
 *
 * Antes cada coisa aprovável tinha o seu próprio registro, e a fila era remendada no navegador
 * fundindo duas chamadas. Aqui o pedido tem forma única: quem pediu, o que pediu sobre o quê, e
 * quem pode decidir.
 *
 * `decidableBy` guarda **userId** (o `authUserId` do membro), que é o que a sessão carrega e o
 * que a autorização compara. Hoje é sempre a lista de `company_admin` ativos, resolvida na
 * criação por `resolveApprovers`. Se um dia o aprovador variar por escopo, muda aquela função e
 * o resto — fila, tela, notificação, trilha — continua igual.
 */
export type MongoApprovalRequest = {
  _id: string;
  tenantId: string;
  companyId: string;
  kind: ApprovalRequestKind;
  status: ApprovalRequestStatus;
  requestedBy: {
    userId: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  /** Sobre o que se pede. Cada tipo preenche o que tem. */
  subject: {
    documentId?: string;
    documentName?: string;
    categoryId?: string;
    categoryName?: string;
    /**
     * A quem a ação se dirige, quando o assunto tem um segundo lado.
     *
     * Em `document_share` é o destinatário: sem ele, dois pedidos do mesmo documento para pessoas
     * diferentes seriam o mesmo pedido, e o índice único barraria o segundo.
     */
    memberId?: string;
    memberName?: string;
  };
  /**
   * O necessário para executar a ação quando aprovada.
   *
   * É o que torna o pedido reentrante: aprovar um envio tem de publicar o documento, e quem
   * aprova não tem o contexto de quem pediu.
   */
  payload: Record<string, unknown>;
  decidableBy: string[];
  decidedBy?: string;
  decidedAt?: Date;
  /** Motivo, obrigatório ao recusar. */
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Um pedido para **outra pessoa enviar** um documento.
 *
 * Não é `MongoApprovalRequest`, e a distinção é o motivo de a coleção existir: aquilo é um pedido
 * para um administrador **decidir** algo que já aconteceu; isto é um pedido para alguém **fazer**
 * algo que ainda não existe. Compartilham a forma e nada mais — fundir os dois faria a fila de
 * aprovações do administrador mostrar trabalho que não é dele.
 *
 * `categoryId` é de quem pede, não de quem envia. É o que separa a requisição de um upload comum:
 * quem pede já sabe onde o documento mora, e com isso a governança do que entra fica decidida
 * antes de o arquivo existir.
 */
export type DocumentRequestStatus = 'pending' | 'fulfilled' | 'cancelled' | 'expired';

export type MongoDocumentRequest = {
  _id: string;
  tenantId: string;
  companyId: string;
  requestedBy: {
    userId: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  /** De quem se pede: membro do mesmo tenant, ou usuário DOQYN de outra empresa. */
  requestedFrom: {
    userId: string;
    membershipId?: string;
    name: string;
    email: string;
  };
  /**
   * Presente quando o pedido atravessa a fronteira da empresa.
   *
   * Quem recebe está fora e não alcança o cadastro de quem pediu: sem o nome da empresa copiado
   * aqui, a lista dele mostraria um pedido vindo de lugar nenhum.
   */
  crossTenant?: {
    requesterTenantName: string;
  };
  title: string;
  description?: string;
  /**
   * Categoria de destino, escolhida por quem pede.
   *
   * **Ausente no pedido para fora**, e isso não é omissão: o documento vai nascer e morar no
   * acervo de quem envia, governado por lá. Impor uma categoria do lado de cá seria prometer um
   * destino que o documento nunca terá — quem pede recebe leitura pela concessão, não posse.
   */
  categoryId?: string;
  categoryName?: string;
  dueAt?: Date;
  status: DocumentRequestStatus;
  /** O documento que cumpriu o pedido. Presente só em `fulfilled`. */
  fulfilledDocumentId?: string;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoUserDocumentFavorite = {
  _id: string;
  userId: string;
  documentId: string;
  tenantId?: string;
  documentTenantType?: TenantType;
  documentClassId?: string;
  versionId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

/**
 * A decisão explícita de quem é contato — e de quem não é.
 *
 * A lista de contatos é derivada do que já aconteceu, e é o que basta para quase tudo. Faltavam
 * as duas pontas que nenhum histórico produz: alguém com quem ainda não se trocou nada (`saved`)
 * e alguém que o histórico oferece e a pessoa não quer ver (`hidden`).
 *
 * Um estado só, e não duas coleções: os dois são a mesma frase — "eu decido sobre este contato" —
 * e separá-los criaria o caso sem sentido de alguém salvo e oculto ao mesmo tempo.
 */
export type SavedContactStatus = 'saved' | 'hidden';

export type MongoSavedContact = {
  _id: string;
  /** De quem é a lista. Nunca do tenant: contato é do indivíduo, e não da empresa. */
  ownerUserId: string;
  tenantId: string;
  contactUserId: string;
  status: SavedContactStatus;
  /**
   * Cópia do rótulo no momento da decisão.
   *
   * Só para o caso de o auth-service não responder: o nome e o apelido vivos vêm de lá a cada
   * abertura. Sem a cópia, a lista de alguém salvo e nunca acionado ficaria com o id cru na tela
   * quando a rede falhasse.
   */
  nameSnapshot?: string;
  usernameSnapshot?: string;
  emailSnapshot?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentShareGrantStatus = 'active' | 'revoked';

/**
 * O que chega de outro tenant não entra no acervo sozinho.
 *
 * `pending` é o estado da caixa de entrada: a concessão existe, mas não concede nada — não aparece
 * na Biblioteca de quem recebe, nem em "Compartilhados comigo", nem passa na autorização. Só o
 * aceite a torna real.
 *
 * A aprovação de saída protege quem **envia**; ela não protege quem **recebe**. Sem este estado,
 * qualquer tenant empurra documento para dentro de qualquer outro e o destinatário não decide nada.
 */
export type InboundShareStatus = 'pending' | 'accepted' | 'declined';

export type InboundShareState = {
  status: InboundShareStatus;
  /** Onde mora quem recebe. É o que distingue a concessão que atravessa a fronteira da empresa. */
  recipientTenantId: string;
  decidedAt?: Date | null;
  /**
   * O essencial do que chegou, copiado na hora do envio.
   *
   * A caixa de entrada é lida por quem está **fora** do tenant de origem: ele não alcança o acervo
   * de lá para descobrir o nome do documento nem o de quem enviou. Sem esta cópia, mostrar a lista
   * exigiria uma leitura cross-tenant a cada abertura — justamente o acesso que o aceite ainda não
   * concedeu.
   *
   * É o nome de quando foi enviado, e isso é o certo: aceita-se o que foi oferecido.
   */
  offer: {
    documentName: string;
    sharedByName: string;
    /** Para que a segunda conversa não exija redigitar o e-mail da primeira. */
    sharedByEmail?: string;
    originTenantName: string;
    /**
     * O nome de quem recebe, visto do lado de quem envia.
     *
     * Quem enviou também não alcança o cadastro do outro lado: sem esta cópia, "Quem tem acesso"
     * mostraria o id cru da pessoa para quem acabou de escolhê-la pelo nome.
     */
    recipientName: string;
    recipientEmail?: string;
  };
};

export type DocumentSharePermissions = {
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
};

/** Concessão explícita de acesso a documento entre usuários do mesmo tenant. */
export type MongoDocumentShareGrant = {
  _id: string;
  documentId: string;
  tenantId: string;
  documentTenantType?: TenantType;
  sharedByUserId: string;
  sharedWithUserId: string;
  permissions: DocumentSharePermissions;
  status: DocumentShareGrantStatus;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date | null;
  revokedBy?: string | null;
  expiresAt?: Date | null;
  /**
   * Presente só quando a concessão cruza a fronteira do tenant. Ausente significa "de casa", e
   * concessão de casa continua valendo na hora — exigir aceite dentro da própria empresa trocaria
   * um compartilhamento por uma pendência sem motivo.
   */
  inbound?: InboundShareState;
};

export type ExternalDocumentShareGrantStatus = 'pending' | 'active' | 'revoked' | 'expired';

export type ExternalDocumentSharePermissions = {
  canView: boolean;
  canDownload: boolean;
};

/** Concessão explícita de acesso a documento para convidado externo (fora do tenant). */
export type MongoExternalDocumentShareGrant = {
  _id: string;
  documentId: string;
  tenantId: string;
  documentTenantType?: TenantType;
  sharedByUserId: string;
  sharedByNameSnapshot?: string;
  recipientEmail: string;
  recipientEmailNormalized: string;
  recipientPhone?: string | null;
  recipientPhoneNormalized?: string | null;
  recipientPhoneCountryCode?: string | null;
  recipientPhoneMasked?: string | null;
  recipientName?: string | null;
  recipientOrganizationName?: string | null;
  recipientTaxId?: string | null;
  permissions: ExternalDocumentSharePermissions;
  status: ExternalDocumentShareGrantStatus;
  message?: string | null;
  inviteTokenHash: string;
  /** Cópia reversível do token, para o dono poder copiar o link de novo. Ver linkTokenCipher. */
  inviteTokenEncrypted?: string | null;
  inviteExpiresAt: Date;
  acceptedAt?: Date | null;
  lastAccessAt?: Date | null;
  accessCodeHash?: string | null;
  accessCodeExpiresAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date | null;
  revokedBy?: string | null;
};

export type DocumentSignatureRequestStatus =
  | 'pending'
  | 'partially_signed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type DocumentSignatureSignerStatus = 'pending' | 'signed' | 'declined';

export type DocumentSignatureSignerType = 'internal_user' | 'external_guest';

export type DocumentSignatureSignerPermissions = {
  canViewForSigning: boolean;
  canSign: boolean;
  canDownloadSignedPdf: boolean;
};

export type DocumentSignaturePermissions = {
  canView: boolean;
  canSign: boolean;
  canDownloadAfterSign: boolean;
};

export type MongoDocumentSignatureSigner = {
  signerId: string;
  signerType: DocumentSignatureSignerType;
  userId?: string | null;
  tenantId?: string | null;
  name: string;
  email: string;
  emailNormalized: string;
  phone?: string | null;
  phoneNormalized?: string | null;
  phoneMasked?: string | null;
  organizationName?: string | null;
  permissions?: DocumentSignatureSignerPermissions;
  status: DocumentSignatureSignerStatus;
  signedAt?: Date | null;
  declinedAt?: Date | null;
  expiresAt?: Date | null;
  order?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Solicitação de assinatura eletrônica auditável DOQYN (não ICP-Brasil). */
export type MongoDocumentSignatureRequest = {
  _id: string;
  signatureRequestId: string;
  documentId: string;
  versionId: string;
  tenantId: string;
  documentTenantType?: TenantType;
  requestedByUserId: string;
  requestedByNameSnapshot?: string | null;
  status: DocumentSignatureRequestStatus;
  signers: MongoDocumentSignatureSigner[];
  permissions: DocumentSignaturePermissions;
  /** Hash do token de portal — apenas para signatários externos. */
  signatureTokenHash?: string | null;
  /** Cópia reversível do token do portal, para recopiar o link. Ver linkTokenCipher. */
  signatureTokenEncrypted?: string | null;
  expiresAt?: Date | null;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
};

export type DocumentSignatureStatus = 'signed' | 'revoked' | 'invalidated';

export type MongoDocumentSignature = {
  _id: string;
  signatureId: string;
  signatureRequestId: string;
  documentId: string;
  versionId: string;
  signerId: string;
  signerType: DocumentSignatureSignerType;
  signerUserId?: string | null;
  signerName: string;
  signerEmailMasked: string;
  signerEmailHash: string;
  signerPhoneMasked?: string | null;
  signerPhoneHash?: string | null;
  organizationName?: string | null;
  status: DocumentSignatureStatus;
  signedAt: Date;
  consentText: string;
  authMethod: 'logged_in_session' | 'external_share_token' | 'signature_token' | 'manual_dev';
  securityContext?: Record<string, unknown>;
  originalDocumentHashSha256: string;
  signedPdfHashSha256: string;
  evidenceHashSha256: string;
  signedPdfR2Key: string;
  evidenceJsonR2Key: string;
  verificationCode: string;
  verificationUrl: string;
  /** Versão do documento criada a partir do PDF assinado. */
  promotedVersionId?: string | null;
  createdAt: Date;
};

export type DocumentSignatureStatusLabel = 'none' | 'pending' | 'signed' | 'declined' | 'expired';
