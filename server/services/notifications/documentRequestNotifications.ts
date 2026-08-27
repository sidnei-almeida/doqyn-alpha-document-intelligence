import type { MongoDocumentRequest } from '../../db/types.js';
import { logger } from '../../utils/logger.js';
import { emitNotifications } from './notificationService.js';

/**
 * Notificar nunca derruba a ação que a originou.
 *
 * O pedido já foi criado, o documento já foi salvo — falhar o request por causa do aviso trocaria
 * um problema pequeno e recuperável por um grande e visível. Mesma regra de
 * `documentNotifications.ts` e `approvalNotifications.ts`.
 */
async function safely(what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.warn('notification not emitted', {
      what,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function formatDueDate(value: Date | undefined): string | null {
  if (!value) return null;
  return value.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** Avisa quem vai enviar que há um documento sendo pedido a ele. */
export async function notifyDocumentRequested(request: MongoDocumentRequest): Promise<void> {
  await safely('document_requested', () => {
    const due = formatDueDate(request.dueAt);
    return emitNotifications({
      tenantId: request.tenantId,
      companyId: request.companyId,
      type: 'document_requested',
      recipients: [request.requestedFrom.userId],
      // Um pedido, um aviso. Reprocessar não enche a caixa de quem vai enviar.
      eventKey: request._id,
      title: `${request.requestedBy.name} pediu um documento`,
      body: due ? `${request.title} — até ${due}` : request.title,
      categoryId: request.categoryId,
      categoryName: request.categoryName,
      actorUserId: request.requestedBy.userId,
      actorName: request.requestedBy.name,
    });
  });
}

/**
 * Avisa quem pediu que o documento chegou.
 *
 * É este o aviso do fato, e por isso a concessão de leitura criada junto **não** notifica: dois
 * avisos para o mesmo acontecimento, um deles chamando de "compartilhamento" o que foi uma
 * entrega, contariam a mesma coisa duas vezes com a palavra errada.
 */
export async function notifyDocumentRequestFulfilled(
  request: MongoDocumentRequest,
  documentName: string,
): Promise<void> {
  await safely('document_request_fulfilled', () =>
    emitNotifications({
      tenantId: request.tenantId,
      companyId: request.companyId,
      type: 'document_request_fulfilled',
      recipients: [request.requestedBy.userId],
      // A chave é o documento, não o pedido: um pedido reaberto e atendido de novo é fato novo.
      eventKey: `${request._id}:${request.fulfilledDocumentId ?? documentName}`,
      title: 'Seu pedido foi atendido',
      body: `${request.requestedFrom.name} enviou ${documentName}.`,
      documentId: request.fulfilledDocumentId,
      documentName,
      categoryId: request.categoryId,
      categoryName: request.categoryName,
      actorUserId: request.requestedFrom.userId,
      actorName: request.requestedFrom.name,
    }),
  );
}
