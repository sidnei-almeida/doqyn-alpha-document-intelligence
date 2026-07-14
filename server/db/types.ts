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
};

export type TrashRetentionMode = 'days' | 'manual';

export type MongoTenantTrashSettings = {
  trashRetentionMode: TrashRetentionMode;
  trashRetentionDays: number;
};

export type MongoTenantSettings = {
  trash?: MongoTenantTrashSettings;
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

export type PlatformRole = 'doqyn_admin' | 'company_admin' | 'individual_admin' | 'user';

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
};

export type MongoDocumentAccessPermissions = {
  view: boolean;
  download: boolean;
  upload: boolean;
  share: boolean;
  manage: boolean;
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
  scope?: 'global' | 'tenant';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoStorageSlot = {
  provider: 'aws_s3' | 'cloudflare_r2' | 'local';
  status: StoragePlaceholderStatus;
  objectKey: string | null;
  bucketAlias: string | null;
  storedAt: Date | null;
};

export type MongoPreviewStorageStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

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
  description: string;
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

export type MongoUserDocumentFavorite = {
  _id: string;
  userId: string;
  documentId: string;
  documentTenantId?: string;
  documentTenantType?: TenantType;
  documentCollection?: string;
  documentClassId?: string;
  versionId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type DocumentShareGrantStatus = 'active' | 'revoked';

export type DocumentSharePermissions = {
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
};

/** Concessão explícita de acesso a documento entre usuários do mesmo tenant. */
export type MongoDocumentShareGrant = {
  _id: string;
  documentId: string;
  documentTenantId: string;
  documentTenantType?: TenantType;
  documentCollection?: string;
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
  documentTenantId: string;
  documentTenantType?: TenantType;
  documentCollection?: string;
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
  documentTenantId: string;
  documentTenantType?: TenantType;
  documentCollection?: string;
  requestedByUserId: string;
  requestedByNameSnapshot?: string | null;
  status: DocumentSignatureRequestStatus;
  signers: MongoDocumentSignatureSigner[];
  permissions: DocumentSignaturePermissions;
  /** Hash do token de portal — apenas para signatários externos. */
  signatureTokenHash?: string | null;
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
