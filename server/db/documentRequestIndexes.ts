import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const DOCUMENT_REQUEST_INDEXES: IndexDescription[] = [
  // "O que me pediram": a lista que a pessoa abre, mais recente primeiro.
  { key: { tenantId: 1, 'requestedFrom.userId': 1, status: 1, createdAt: -1 } },
  // "O que eu pedi": o outro lado da mesma tela.
  { key: { tenantId: 1, 'requestedBy.userId': 1, status: 1, createdAt: -1 } },
  // A varredura diária que vence pedido parado. Sem ela o job leria a coleção inteira.
  { key: { status: 1, dueAt: 1 } },
  // Do documento de volta ao pedido que o originou — trilha e limpeza.
  { key: { tenantId: 1, fulfilledDocumentId: 1 } },
];

export async function ensureDocumentRequestIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentRequests,
    DOCUMENT_REQUEST_INDEXES,
  );
}
