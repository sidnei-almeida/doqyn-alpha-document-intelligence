/**
 * Vocabulário de notificação — tipos de evento, canais e estado de entrega.
 *
 * Vive em `db/` porque descreve o que é gravado, e não como é decidido: a política de quem recebe
 * e por qual canal mora em `server/services/notifications/`.
 */

export type NotificationType =
  | 'document_expiring'
  | 'document_created'
  | 'document_updated'
  | 'signature_required'
  | 'document_shared'
  | 'access_approved'
  | 'access_rejected'
  | 'approval_requested'
  | 'approval_decided'
  | 'document_requested'
  | 'document_request_fulfilled'
  | 'inbound_share_received'
  | 'inbound_share_accepted'
  | 'inbound_share_declined'
  | 'member_joined';

export type NotificationStatus = 'unread' | 'read' | 'dismissed';

export type NotificationChannel = 'in_app' | 'email' | 'whatsapp';

/**
 * `skipped_no_provider` é o estado normal de e-mail e WhatsApp enquanto não há SMTP nem Meta API
 * configurados: a intenção de entrega fica registrada, e ligar o provedor depois não exige mexer
 * em quem emite. `skipped_by_preference` separa "não quis" de "não deu" — sem essa distinção,
 * qualquer relatório de entrega mentiria sobre a razão do silêncio.
 */
export type NotificationDeliveryStatus =
  | 'delivered'
  | 'queued'
  /** Travada por um drenador: existe para duas instâncias não mandarem o mesmo aviso duas vezes. */
  | 'sending'
  | 'skipped_no_provider'
  | 'skipped_by_preference'
  | 'failed';
