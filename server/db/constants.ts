export const DEV_TENANT_ID =
  process.env.MONGODB_TENANT_ID?.trim() ||
  process.env.MONGODB_COMPANY_ID?.trim() ||
  'company_dev';

/** @deprecated Use DEV_TENANT_ID */
export const DEV_COMPANY_ID = DEV_TENANT_ID;

export const REGISTRY_COLLECTIONS = {
  tenants: 'tenants',
  tenantMembers: 'tenant_members',
  /** Legado — mantido durante migração */
  companies: 'companies',
  companyMembers: 'company_members',
} as const;

/** Coleções globais do app documental (não prefixadas por tenant). */
export const SHARED_APP_COLLECTIONS = {
  userDocumentFavorites: 'user_document_favorites',
  documentShareGrants: 'document_share_grants',
  externalDocumentShareGrants: 'external_document_share_grants',
  documentSignatureRequests: 'document_signature_requests',
  documentSignatures: 'document_signatures',
  documentUploadApprovals: 'document_upload_approvals',
  analysisJobs: 'analysis_jobs',
  documentExpiryAlerts: 'document_expiry_alerts',
} as const;

export const COLLECTIONS = {
  /** @deprecated Retirado do resolver — grupos vivem no Auth + document_groups */
  accessGroups: 'access_groups',
  /** @deprecated Retirado do resolver — preferir documentCategories */
  documentClasses: 'document_classes',
  documentCategories: 'document_categories',
  documentGroups: 'document_groups',
  documentGroupMembers: 'document_group_members',
  /** Regras de acesso grupo×categoria */
  documentRules: 'document_rules',
  /** Regras de extração IA por categoria */
  documentExtractionRules: 'document_extraction_rules',
  documents: 'documents',
  documentVersions: 'document_versions',
  documentChunks: 'document_chunks',
  processingJobs: 'processing_jobs',
  auditLogs: 'audit_logs',
} as const;
