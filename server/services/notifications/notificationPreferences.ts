import type { NotificationChannel, NotificationType } from '../../db/notificationTypes.js';
import type { NotificationPreferences } from '../../db/types.js';
import { mergeNotificationPreferences } from '../accessRequestService.js';
import { listTenantMembers } from '../tenantMemberRepository.js';

/**
 * Qual chave de preferência governa cada tipo.
 *
 * `document_expiring` é o único sem chave: vencimento não é aviso de cortesia, é o documento
 * dizendo que deixa de valer. Quem tem acesso precisa saber, tenha marcado o que tiver marcado —
 * é a mesma razão pela qual o dono é sempre notificado.
 */
export const PREFERENCE_KEY_BY_TYPE: Record<
  NotificationType,
  keyof NotificationPreferences | null
> = {
  document_expiring: null,
  document_created: 'documentCreated',
  document_updated: 'documentUpdated',
  signature_required: 'documentRequiresSignature',
  document_shared: 'documentShared',
  access_approved: 'accessApproved',
  access_rejected: 'accessRejected',
  // Sem preferência, de propósito. Um pedido esperando decisão é trabalho atribuído a quem
  // administra o tenant, e a resposta ao próprio pedido é o fim de uma conversa que a pessoa
  // começou — nenhum dos dois é aviso que se escolhe receber.
  approval_requested: null,
  approval_decided: null,
  // Mesma razão dos dois acima. Um documento pedido a você é trabalho que alguém lhe atribuiu, e
  // saber que o pedido foi atendido é o fim de uma conversa que você começou — nenhum dos dois é
  // aviso de cortesia que se escolhe receber.
  document_requested: null,
  document_request_fulfilled: null,
  // Também sem preferência. Um documento de outra empresa esperando o seu aceite é decisão sua e
  // de mais ninguém — silenciá-lo esconderia o item que só você pode liberar. E a resposta ao
  // aceite fecha a conversa que quem enviou começou.
  inbound_share_received: null,
  inbound_share_accepted: null,
  inbound_share_declined: null,
};

/**
 * Preferências dos destinatários, por `userId` do auth.
 *
 * Quem não tem membro no tenant — ou tem membro sem preferência gravada — cai no default de
 * `mergeNotificationPreferences`: tudo ligado. Silenciar por ausência de registro faria a
 * notificação sumir justamente para quem nunca abriu a tela de acesso.
 */
export async function loadNotificationPreferences(
  tenantId: string,
  userIds: Iterable<string>,
): Promise<Map<string, NotificationPreferences>> {
  const wanted = new Set(userIds);
  const byUserId = new Map<string, NotificationPreferences>();
  if (wanted.size === 0) return byUserId;

  const members = await listTenantMembers(tenantId);
  for (const member of members) {
    const userId = member.authUserId;
    if (!userId || !wanted.has(userId)) continue;
    byUserId.set(userId, mergeNotificationPreferences(member.notificationPreferences));
  }

  for (const userId of wanted) {
    if (!byUserId.has(userId)) byUserId.set(userId, mergeNotificationPreferences());
  }

  return byUserId;
}

export function wantsNotification(
  preferences: NotificationPreferences,
  type: NotificationType,
): boolean {
  const key = PREFERENCE_KEY_BY_TYPE[type];
  if (!key) return true;
  return preferences[key] !== false;
}

/**
 * Canais que a pessoa aceita para esta notificação.
 *
 * `in_app` não é opcional: é onde a notificação já está — a caixa do sino é o registro, não uma
 * entrega paralela. `email` e `whatsapp` são escolha, e hoje param no outbox por falta de
 * provedor.
 */
export function channelsForMember(preferences: NotificationPreferences): NotificationChannel[] {
  const channels: NotificationChannel[] = ['in_app'];
  if (preferences.email) channels.push('email');
  if (preferences.whatsapp) channels.push('whatsapp');
  return channels;
}
