import type { MongoApprovalRequest } from '../../db/types.js';
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

const KIND_LABEL: Record<MongoApprovalRequest['kind'], string> = {
  document_upload: 'Envio de documento',
  document_download: 'Download de documento',
};

function subjectLine(request: MongoApprovalRequest): string {
  return request.subject.documentName ?? KIND_LABEL[request.kind];
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
      title: `${request.requestedBy.name} pediu aprovação`,
      body: subjectLine(request),
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
      title: approved ? 'Seu pedido foi aprovado' : 'Seu pedido foi recusado',
      body: request.reason ? `${subjectLine(request)} — ${request.reason}` : subjectLine(request),
      documentId: request.subject.documentId,
      documentName: request.subject.documentName,
      categoryId: request.subject.categoryId,
      categoryName: request.subject.categoryName,
      actorUserId: request.decidedBy,
      actorName: decidedByName,
    }),
  );
}
