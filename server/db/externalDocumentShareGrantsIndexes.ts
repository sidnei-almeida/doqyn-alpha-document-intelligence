import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const EXTERNAL_DOCUMENT_SHARE_GRANTS_INDEXES: IndexDescription[] = [
  {
    key: { documentId: 1, recipientEmailNormalized: 1 },
    unique: true,
    name: 'documentId_recipientEmail_active_pending_unique',
    partialFilterExpression: { status: { $in: ['active', 'pending'] } },
  },
  { key: { documentId: 1, status: 1 } },
  { key: { recipientEmailNormalized: 1, status: 1, createdAt: -1 } },
  { key: { inviteTokenHash: 1 }, unique: true },
  { key: { tenantId: 1, status: 1 } },
];

export async function ensureExternalDocumentShareGrantsIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.externalDocumentShareGrants,
    EXTERNAL_DOCUMENT_SHARE_GRANTS_INDEXES,
  );
}
