import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const DOCUMENT_UPLOAD_APPROVAL_INDEXES: IndexDescription[] = [
  { key: { tenantId: 1, status: 1, createdAt: -1 } },
  { key: { tenantId: 1, 'submittedBy.userId': 1, status: 1 } },
  // `tenantId` lidera: liderar por `fileHash` deixava o índice responder "quem mais no pool enviou
  // este arquivo?" atravessando tenant. Deduplicação é por tenant, não global — dois clientes podem
  // ter o mesmo PDF sem que um saiba do outro.
  { key: { tenantId: 1, fileHash: 1, status: 1 } },
];

export async function ensureDocumentUploadApprovalIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentUploadApprovals,
    DOCUMENT_UPLOAD_APPROVAL_INDEXES,
  );
}
