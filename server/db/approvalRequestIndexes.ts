import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const APPROVAL_REQUEST_INDEXES: IndexDescription[] = [
  // A fila, que é o acesso mais quente: pendentes do tenant, mais antigo primeiro — quem espera
  // há mais tempo aparece na frente.
  { key: { tenantId: 1, status: 1, createdAt: 1 } },
  // "O que eu posso decidir": mesma fila, filtrada por quem abre a tela.
  { key: { tenantId: 1, decidableBy: 1, status: 1, createdAt: 1 } },
  // Histórico de um documento, e limpeza quando ele é excluído.
  { key: { tenantId: 1, 'subject.documentId': 1 } },
  // Um pedido pendente por (tipo, assunto): dois cliques no mesmo botão não enfileiram dois.
  // Parcial porque o mesmo assunto pode ser pedido de novo depois de recusado.
  {
    key: { tenantId: 1, kind: 1, 'subject.documentId': 1 },
    unique: true,
    name: 'tenant_kind_document_pending_unique',
    partialFilterExpression: { status: 'pending' },
  },
];

export async function ensureApprovalRequestIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.approvalRequests,
    APPROVAL_REQUEST_INDEXES,
  );
}
