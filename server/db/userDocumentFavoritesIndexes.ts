import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const USER_DOCUMENT_FAVORITES_INDEXES: IndexDescription[] = [
  {
    key: { userId: 1, documentId: 1 },
    unique: true,
    name: 'userId_documentId_unique',
    // Atlas não aceita $or/$exists:false em partialFilterExpression.
    partialFilterExpression: { deletedAt: null },
  },
  { key: { userId: 1, deletedAt: 1, createdAt: -1 } },
  { key: { documentId: 1 } },
  { key: { userId: 1, tenantId: 1, deletedAt: 1 } },
];

export async function ensureUserDocumentFavoritesIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.userDocumentFavorites,
    USER_DOCUMENT_FAVORITES_INDEXES,
  );
}
