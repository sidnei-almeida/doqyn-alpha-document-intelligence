import type { MongoDocumentRequest } from '../../db/types.js';
import { logger } from '../../utils/logger.js';
import { emitNotifications } from './notificationService.js';
import { findActiveTenantIdsForUser } from '../tenantMemberRepository.js';

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
  const due = formatDueDate(request.dueAt);
  const title = request.crossTenant
    ? `${request.crossTenant.requesterTenantName} pediu um documento`
    : `${request.requestedBy.name} pediu um documento`;
  const body = due ? `${request.title} · até ${due}` : request.title;

  /**
   * O aviso é gravado na caixa de quem vai enviar, e ela vive no tenant dele.
   *
   * No pedido de dentro de casa é o mesmo tenant do pedido. No pedido que atravessa a fronteira,
   * não: quem recebe está em outra empresa — e pode estar em mais de uma —, e usar o tenant de
   * quem pediu gravaria o aviso numa caixa que o destinatário não abre.
   */
  const tenantIds = request.crossTenant
    ? await findActiveTenantIdsForUser(request.requestedFrom.userId)
    : [request.tenantId];

  for (const tenantId of tenantIds) {
    await safely('document_requested', () =>
      emitNotifications({
        tenantId,
        companyId: tenantId,
        type: 'document_requested',
        recipients: [request.requestedFrom.userId],
        // Um pedido, um aviso por caixa. Reprocessar não enche a de quem vai enviar.
        eventKey: `${request._id}:${tenantId}`,
        title,
        body,
        categoryId: request.categoryId,
        categoryName: request.categoryName,
        actorUserId: request.requestedBy.userId,
        actorName: request.requestedBy.name,
      }),
    );
  }
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
  /**
   * O que veio de fora ainda não é alcançável: ele espera o aceite de quem pediu.
   *
   * Por isso o aviso não carrega `documentId` nesse caso — o link levaria a uma ficha que a
   * autorização recusa, e prometer acesso antes do aceite é o oposto do que o aceite existe para
   * fazer. Sem o id, a tela manda para a fila de decisão.
   */
  const crossTenant = Boolean(request.crossTenant);

  await safely('document_request_fulfilled', () =>
    emitNotifications({
      tenantId: request.tenantId,
      companyId: request.companyId,
      type: 'document_request_fulfilled',
      recipients: [request.requestedBy.userId],
      // A chave é o documento, não o pedido: um pedido reaberto e atendido de novo é fato novo.
      eventKey: `${request._id}:${request.fulfilledDocumentId ?? documentName}`,
      title: 'Seu pedido foi atendido',
      body: crossTenant
        ? `${request.requestedFrom.name} enviou ${documentName}. Aceite para ver.`
        : `${request.requestedFrom.name} enviou ${documentName}.`,
      ...(crossTenant ? {} : { documentId: request.fulfilledDocumentId }),
      documentName,
      categoryId: request.categoryId,
      categoryName: request.categoryName,
      actorUserId: request.requestedFrom.userId,
      actorName: request.requestedFrom.name,
    }),
  );
}
