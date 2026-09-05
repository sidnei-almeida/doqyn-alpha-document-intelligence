import type { NotificationChannel, NotificationType } from '../../db/notificationTypes.js';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '../../db/types.js';
import { listTenantMembers } from '../tenantMemberRepository.js';

/**
 * As preferências gravadas sobre o default, e não em lugar dele.
 *
 * Quem foi gravado antes de um evento existir não tem a chave nova; sem a mescla, o servidor
 * leria `undefined` como "não quer receber" — o silêncio de um campo que nunca foi perguntado
 * viraria uma recusa que ninguém deu.
 *
 * Morava em `accessRequestService`, que saiu junto com o pedido de acesso.
 */
export function mergeNotificationPreferences(
  input?: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(input ?? {}),
  };
}

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
/**
 * O que vale interromper alguém fora do app.
 *
 * **A preferência do usuário diz "aceito receber"; esta lista diz "isto merece um e-mail".** Sem
 * ela, ligar o canal mandaria e-mail de tudo que a pessoa aceita no sino — inclusive documento
 * criado, que num tenant ativo são dezenas por dia. O fim conhecido dessa história é a pessoa criar
 * um filtro e nunca mais ler nenhum, inclusive os que importavam.
 *
 * O corte é por consequência, não por importância sentida:
 *
 * · **Só existe fora do app.** `access_approved` e `access_rejected` vão para quem ainda não entra
 *   no sistema — o e-mail é o único canal que essa pessoa tem.
 * · **Trabalho atribuído a você**, e que trava alguém enquanto não é feito: assinatura, pedido de
 *   documento, aprovação esperando decisão, documento de outra empresa esperando aceite.
 * · **Tem prazo próprio**: vencimento é o documento avisando que deixa de valer.
 * · **Deu acesso a algo que a pessoa não sabia que existia**: compartilhamento. Quem recebeu não
 *   tem como adivinhar que ganhou o documento.
 *
 * Fora ficaram os avisos de atividade — documento criado e nova versão. Eles contam o que
 * aconteceu, não pedem nada, e são exatamente o volume que desqualifica a caixa de entrada.
 */
export const EMAIL_ELIGIBLE_TYPES: ReadonlySet<NotificationType> = new Set([
  'access_approved',
  'access_rejected',
  'signature_required',
  'document_expiring',
  'document_requested',
  'approval_requested',
  'inbound_share_received',
  'document_shared',
]);

export function isEmailEligible(type: NotificationType): boolean {
  return EMAIL_ELIGIBLE_TYPES.has(type);
}

export function channelsForMember(
  preferences: NotificationPreferences,
  type: NotificationType,
): NotificationChannel[] {
  const channels: NotificationChannel[] = ['in_app'];
  // Duas perguntas, e as duas precisam de sim: a pessoa aceita e-mail, e este aviso merece um.
  if (preferences.email && isEmailEligible(type)) channels.push('email');
  if (preferences.whatsapp) channels.push('whatsapp');
  return channels;
}

/**
 * O degrau de vencimento a partir do qual o aviso vira e-mail.
 *
 * Os degraus configurados costumam ser 30/15/7/1 — quatro avisos do mesmo contrato. No sino isso
 * funciona: são quatro linhas numa caixa que a pessoa abre quando quer. Na caixa de entrada, quatro
 * e-mails sobre o mesmo documento é o que ensina alguém a ignorar o quarto, que é justamente o
 * urgente. Longe do prazo o sino basta; perto dele, o e-mail vale a interrupção.
 */
export const EXPIRY_EMAIL_MAX_OFFSET_DAYS = 7;

/**
 * Ajusta os canais ao aviso concreto — hoje, só o vencimento precisa disso.
 *
 * A escolha de canal é feita por usuário, antes de a notificação existir; o degrau, porém, é de
 * cada aviso. Este é o ponto em que os dois se encontram.
 */
export function channelsForNotification(
  channels: NotificationChannel[],
  notification: { type: NotificationType; expiry?: { offsetDays: number } },
): NotificationChannel[] {
  if (notification.type !== 'document_expiring') return channels;

  const offset = notification.expiry?.offsetDays;
  if (offset === undefined || offset <= EXPIRY_EMAIL_MAX_OFFSET_DAYS) return channels;

  return channels.filter((channel) => channel !== 'email');
}
