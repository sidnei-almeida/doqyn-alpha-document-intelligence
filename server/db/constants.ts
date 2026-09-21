export const DEV_TENANT_ID =
  process.env.MONGODB_TENANT_ID?.trim() || process.env.MONGODB_COMPANY_ID?.trim() || 'company_dev';

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
  /** Caixa de notificações do usuário — vencimento é um tipo entre outros. */
  notifications: 'notifications',
  /** Registro de entrega por canal. Ver `notificationTypes.ts`. */
  notificationDeliveries: 'notification_deliveries',
  /** Pedidos esperando decisão do administrador do tenant. Ver `MongoApprovalRequest`. */
  approvalRequests: 'approval_requests',
  /** Ponteiro da cadeia de integridade da trilha de auditoria, um por tenant. */
  auditChainHeads: 'audit_chain_heads',
  /** Pedidos para alguém **enviar** um documento. Ver `MongoDocumentRequest`. */
  documentRequests: 'document_requests',
  /** Contato salvo à mão, ou dispensado da lista derivada. Ver `MongoSavedContact`. */
  savedContacts: 'saved_contacts',
  /** E-mail para quem não tem conta — convite de compartilhamento/assinatura externo. Ver `MongoExternalEmailOutboxRow`. */
  externalEmailOutbox: 'external_email_outbox',
} as const;

export const COLLECTIONS = {
  /** @deprecated Retirado do resolver — grupos vivem no Auth + document_groups */
  accessGroups: 'access_groups',
  /** @deprecated Retirado do resolver — preferir documentCategories */
  documentClasses: 'document_classes',
  documentCategories: 'document_categories',
  documentGroups: 'document_groups',
  documentGroupMembers: 'document_group_members',
  pendingInviteGroups: 'pending_invite_groups',
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
