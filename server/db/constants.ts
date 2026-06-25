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

export const COLLECTIONS = {
  accessGroups: 'access_groups',
  documentClasses: 'document_classes',
  documentRules: 'document_rules',
  documents: 'documents',
  documentVersions: 'document_versions',
  processingJobs: 'processing_jobs',
  auditLogs: 'audit_logs',
} as const;
