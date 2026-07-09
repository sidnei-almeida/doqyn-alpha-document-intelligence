import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const DOCUMENT_SHARE_GRANTS_INDEXES: IndexDescription[] = [
  {
    key: { documentId: 1, sharedWithUserId: 1 },
    unique: true,
    name: 'documentId_sharedWithUserId_active_unique',
    partialFilterExpression: { status: 'active' },
  },
  { key: { sharedWithUserId: 1, status: 1, createdAt: -1 } },
  { key: { sharedByUserId: 1, status: 1, createdAt: -1 } },
  { key: { documentId: 1, status: 1 } },
  { key: { documentTenantId: 1, sharedWithUserId: 1, status: 1 } },
];

export async function ensureDocumentShareGrantsIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentShareGrants,
    DOCUMENT_SHARE_GRANTS_INDEXES,
  );
}
