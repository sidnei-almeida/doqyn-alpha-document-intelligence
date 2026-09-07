import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { getDb } from './mongoClient.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';
import { logger } from '../utils/logger.js';

export const APPROVAL_REQUEST_INDEXES: IndexDescription[] = [
  // A fila, que é o acesso mais quente: pendentes do tenant, mais antigo primeiro — quem espera
  // há mais tempo aparece na frente.
  { key: { tenantId: 1, status: 1, createdAt: 1 } },
  // "O que eu posso decidir": mesma fila, filtrada por quem abre a tela.
  { key: { tenantId: 1, decidableBy: 1, status: 1, createdAt: 1 } },
  // Histórico de um documento, e limpeza quando ele é excluído.
  { key: { tenantId: 1, 'subject.documentId': 1 } },
  // "Quem pediu o quê" — o portão consulta por aqui antes de abrir pedido novo.
  { key: { tenantId: 1, kind: 1, 'requestedBy.userId': 1, 'subject.documentId': 1, status: 1 } },
  /**
   * Um pedido pendente por (tipo, assunto, **quem pediu**, **para quem**).
   *
   * O requerente faz parte da chave: sem ele, o segundo usuário a pedir download do mesmo
   * documento colidiria com o primeiro e ficaria sem conseguir pedir. O destinatário também:
   * compartilhar o mesmo documento com duas pessoas são dois pedidos, e sem `subject.memberId` na
   * chave o segundo seria recusado como duplicata. Pedido sem destinatário — download, envio —
   * indexa `null` ali e continua único por (tipo, documento, requerente).
   *
   * E o filtro exige `subject.documentId`: pedido de envio não tem documento ainda, e o Mongo
   * indexa campo ausente como `null` — dois envios pendentes colidiriam entre si.
   */
  {
    key: {
      tenantId: 1,
      kind: 1,
      'subject.documentId': 1,
      'requestedBy.userId': 1,
      'subject.memberId': 1,
    },
    unique: true,
    name: 'tenant_kind_document_requester_target_pending_unique',
    partialFilterExpression: {
      status: 'pending',
      'subject.documentId': { $exists: true },
    },
  },
];

/**
 * Índices únicos de versões anteriores, com chave mais curta.
 *
 * `ensureIndexesForCollection` casa por forma de chave, então um índice cuja chave mudou não é
 * substituído — ele sobrevive ao lado do novo e continua barrando escrita legítima. Derrubar pelo
 * nome é a única saída. Onde ele nunca existiu, é no-op.
 */
export const SUPERSEDED_APPROVAL_REQUEST_INDEXES = [
  'tenant_kind_document_pending_unique',
  'tenant_kind_document_requester_pending_unique',
];

async function dropSupersededIndexes(): Promise<void> {
  const db = await getDb();
  const collection = db.collection(SHARED_APP_COLLECTIONS.approvalRequests);
  for (const name of SUPERSEDED_APPROVAL_REQUEST_INDEXES) {
    try {
      await collection.dropIndex(name);
      logger.info('índice de aprovações substituído removido', { index: name });
    } catch {
      // Não existe: nada a fazer.
    }
  }
}

export async function ensureApprovalRequestIndexes() {
  await dropSupersededIndexes();
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.approvalRequests,
    APPROVAL_REQUEST_INDEXES,
  );
}
