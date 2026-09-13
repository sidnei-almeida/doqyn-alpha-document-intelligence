import type { MongoApprovalRequest } from '../../db/types.js';
import { compactNotificationParams } from '../../../shared/notificationText.js';
import { logger } from '../../utils/logger.js';
import { emitNotifications } from './notificationService.js';

/**
 * Notificar nunca derruba a ação que a originou.
 *
 * O pedido já foi criado, a decisão já foi gravada — falhar o request por causa do aviso trocaria
 * um problema pequeno e recuperável por um grande e visível. Mesma regra de
 * `documentNotifications.ts`.
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

/**
 * O assunto do pedido: o documento, ou o tipo de pedido quando não há documento, e o outro lado
 * quando é compartilhamento — liberar o documento para Ana é uma decisão, para um fornecedor é
 * outra. A linha é montada em `shared/notificationText.ts`.
 */
function subjectParams(request: MongoApprovalRequest) {
  return {
    kind: request.kind,
    documentName: request.subject.documentName,
    memberName: request.subject.memberName,
  };
}

/** Avisa quem pode decidir que há trabalho na fila. */
export async function notifyApprovalRequested(request: MongoApprovalRequest): Promise<void> {
  await safely('approval_requested', () =>
    emitNotifications({
      tenantId: request.tenantId,
      companyId: request.companyId,
      type: 'approval_requested',
      recipients: request.decidableBy,
      // Um pedido, um aviso por pessoa. Reprocessar não enche a caixa de quem decide.
      eventKey: request._id,
      params: compactNotificationParams({
        actorName: request.requestedBy.name,
        ...subjectParams(request),
      }),
      documentId: request.subject.documentId,
      documentName: request.subject.documentName,
      categoryId: request.subject.categoryId,
      categoryName: request.subject.categoryName,
      actorUserId: request.requestedBy.userId,
      actorName: request.requestedBy.name,
    }),
  );
}

/**
 * Avisa quem pediu qual foi a resposta.
 *
 * O `eventKey` carrega a decisão, não só o id do pedido: aprovado e recusado são fatos distintos,
 * e um pedido reaberto no futuro não deve ser silenciado pela chave única do aviso anterior.
 */
export async function notifyApprovalDecided(
  request: MongoApprovalRequest,
  decidedByName?: string,
): Promise<void> {
  if (!request.requestedBy.userId) return;

  const approved = request.status === 'approved';
  await safely('approval_decided', () =>
    emitNotifications({
      tenantId: request.tenantId,
      companyId: request.companyId,
      type: 'approval_decided',
      recipients: [request.requestedBy.userId],
      eventKey: `${request._id}:${request.status}`,
      params: compactNotificationParams({
        approved,
        reason: request.reason,
        ...subjectParams(request),
      }),
      documentId: request.subject.documentId,
      documentName: request.subject.documentName,
      categoryId: request.subject.categoryId,
      categoryName: request.subject.categoryName,
      actorUserId: request.decidedBy,
      actorName: decidedByName,
    }),
  );
}
