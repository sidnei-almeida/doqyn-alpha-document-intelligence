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
  { key: { tenantId: 1, sharedWithUserId: 1, status: 1 } },
  /**
   * A caixa de entrada: o que chegou de outra empresa e espera decisão.
   *
   * Parcial de propósito. `inbound` só existe na concessão que cruza a fronteira do tenant, e
   * pendente é um estado curto — indexar a coleção inteira para servir essa fatia custaria a
   * escrita de todo compartilhamento de dentro de casa, que é a esmagadora maioria.
   */
  {
    key: { sharedWithUserId: 1, createdAt: -1 },
    name: 'inbound_pending_by_recipient',
    partialFilterExpression: { 'inbound.status': 'pending' },
  },
];

export async function ensureDocumentShareGrantsIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentShareGrants,
    DOCUMENT_SHARE_GRANTS_INDEXES,
  );
}
