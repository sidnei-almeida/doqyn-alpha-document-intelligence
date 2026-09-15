import type { MongoDocumentShareGrant } from '../../db/types.js';
import { compactNotificationParams } from '../../../shared/notificationText.js';
import { logger } from '../../utils/logger.js';
import { emitNotifications } from './notificationService.js';
import { findActiveTenantIdsForUser } from '../tenantMemberRepository.js';

/**
 * Notificar nunca derruba a ação que a originou.
 *
 * Mesma regra de `documentRequestNotifications.ts`: o aceite já foi gravado e a recusa já foi
 * decidida — falhar por causa do aviso trocaria um problema pequeno por um grande.
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
 * Avisa quem recebeu que há um documento de fora esperando decisão.
 *
 * O aviso é emitido no tenant de **quem recebe**, não no de origem: a notificação é lida na caixa
 * dele, e gravá-la do outro lado a deixaria invisível para quem precisa agir.
 */
export async function notifyInboundShareReceived(grant: MongoDocumentShareGrant): Promise<void> {
  if (!grant.inbound) return;
  const { offer } = grant.inbound;

  /**
   * O aviso vai para **todas** as empresas ativas de quem recebe.
   *
   * A notificação é gravada com `tenantId` e o sino consulta por `tenantId` mais `userId`. No
   * envio ainda não se sabe em qual empresa a pessoa vai aceitar — a oferta é para ela, não para
   * uma delas —, então `inbound.recipientTenantId` está vazio nesse instante. Usá-lo aqui gravava
   * o aviso num tenant que não existe, e ninguém o via: a caixa de entrada funcionava e a
   * campainha era muda.
   *
   * O `eventKey` carrega o tenant justamente para que o mesmo fato apareça uma vez em cada caixa,
   * e não seja descartado como repetido.
   */
  const tenantIds = await findActiveTenantIdsForUser(grant.sharedWithUserId);

  for (const tenantId of tenantIds) {
    await safely('inbound_share_received', () =>
      emitNotifications({
        tenantId,
        companyId: tenantId,
        type: 'inbound_share_received',
        recipients: [grant.sharedWithUserId],
        eventKey: `${grant._id}:${tenantId}`,
        params: compactNotificationParams({
          originTenantName: offer.originTenantName,
          documentName: offer.documentName,
          sharedByName: offer.sharedByName,
        }),
        actorUserId: grant.sharedByUserId,
        actorName: offer.sharedByName,
      }),
    );
  }
}

/**
 * Avisa quem enviou o que foi decidido.
 *
 * Vai para o tenant de **origem**, que é onde quem enviou lê as próprias notificações. Recusa não
 * carrega motivo — o plano é explícito nisso, e pedir justificativa transformaria "não quero" em
 * negociação.
 */
export async function notifyInboundShareDecided(
  grant: MongoDocumentShareGrant,
  decision: 'accepted' | 'declined',
  recipientName: string,
): Promise<void> {
  if (!grant.inbound) return;
  const { offer } = grant.inbound;
  const type = decision === 'accepted' ? 'inbound_share_accepted' : 'inbound_share_declined';

  await safely(type, () =>
    emitNotifications({
      tenantId: grant.tenantId,
      companyId: grant.tenantId,
      type,
      recipients: [grant.sharedByUserId],
      // A decisão é uma só; reprocessar não duplica o aviso.
      eventKey: `${grant._id}:${decision}`,
      params: compactNotificationParams({
        recipientName,
        documentName: offer.documentName,
      }),
      documentId: grant.documentId,
      actorUserId: grant.sharedWithUserId,
      actorName: recipientName,
    }),
  );
}
