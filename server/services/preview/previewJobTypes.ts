export type PreviewQueueJobPayload = {
  /** Idempotente por versão: tenantId:documentId:versionId */
  jobId: string;
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  contentType: string;
  previewStorageFileName: string;
  requestId?: string;
};
