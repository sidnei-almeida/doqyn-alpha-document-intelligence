export type StoragePlaceholderStatus = 'pending' | 'stored' | 'failed' | 'skipped';

export type TenantType = 'individual' | 'business';
export type TaxIdType = 'CPF' | 'CNPJ';
export type TenantStatus = 'pending' | 'active' | 'inactive' | 'blocked';
export type TenantIsolationStrategy = 'shared_individual_pool' | 'collection_prefix';

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
  keycloakUserId?: string;
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
  keycloakUserId?: string;
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
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoStorageSlot = {
  provider: 'aws_s3' | 'cloudflare_r2';
  status: StoragePlaceholderStatus;
  objectKey: string | null;
  bucketAlias: string | null;
  storedAt: Date | null;
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

export type MongoDocument = {
  _id: string;
  tenantId: string;
  companyId: string;
  ownerUserId?: string;
  documentCode: string;
  currentVersionId: string;
  classId: string;
  className: string;
  title: string;
  currentFileName: string;
  status: 'active' | 'archived';
  processingStatus: 'processed' | 'requires_review' | 'processed_with_review' | 'pending';
  access: {
    viewGroupIds: string[];
    downloadGroupIds: string[];
    updateGroupIds: string[];
    auditGroupIds: string[];
    shareGroupIds: string[];
  };
  currentMetadataPreview: Record<string, string | number | null>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoDocumentVersion = {
  _id: string;
  tenantId: string;
  companyId: string;
  ownerUserId?: string;
  documentId: string;
  versionNumber: number;
  versionLabel: string;
  previousVersionId: string | null;
  originalFileName: string;
  recommendedFileName: string;
  finalFileName: string;
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
  metadataIndex: MongoMetadataIndexEntry[];
  storage: {
    primary: MongoStorageSlot;
    backup: MongoStorageSlot;
  };
  review: {
    required: boolean;
    reasons: string[];
    reviewedBy: string | null;
    reviewedAt: Date | null;
  };
  createdBy: string;
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
  };
  action:
    | UserAuditAction
    | 'document.created'
    | 'document.version.created'
    | 'document.classified'
    | 'document.metadata.extracted'
    | 'document.metadata.confirmed'
    | 'document.metadata.reviewed_confirmed'
    | 'document.review.required';
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};
