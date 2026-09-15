import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType } from '../api/notificationsApi';
import { i18n } from '@/i18n';
import { formatDate } from '@/i18n/formats';
import { renderNotificationText, type NotificationText } from '@shared/notificationText';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

export type NotificationListProps = {
  notifications: AppNotification[];
  isLoading: boolean;
  onMarkRead: (notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
  compact?: boolean;
};

/**
 * O glifo diz o tipo antes da leitura.
 *
 * Cada fato tem o ícone do lugar de onde veio — assinatura, compartilhamento, versão — porque numa
 * lista de sete avisos diferentes o título sozinho obriga a ler tudo para achar o que interessa.
 */
const TYPE_ICON: Record<NotificationType, string> = {
  document_expiring: 'schedule',
  document_created: 'note_add',
  document_updated: 'history',
  signature_required: 'draw',
  document_shared: 'group',
  access_approved: 'check_circle',
  access_rejected: 'block',
  approval_requested: 'gavel',
  approval_decided: 'gavel',
  document_requested: 'assignment',
  document_request_fulfilled: 'assignment_turned_in',
  inbound_share_received: 'inbox',
  inbound_share_accepted: 'check_circle',
  inbound_share_declined: 'block',
  member_joined: 'person_add',
};

const TYPE_LABEL_KEYS: Record<NotificationType, string> = {
  document_expiring: 'notificationList.type.document_expiring',
  document_created: 'notificationList.type.document_created',
  document_updated: 'notificationList.type.document_updated',
  signature_required: 'notificationList.type.signature_required',
  document_shared: 'notificationList.type.document_shared',
  access_approved: 'notificationList.type.access',
  access_rejected: 'notificationList.type.access',
  approval_requested: 'notificationList.type.approval',
  approval_decided: 'notificationList.type.approval',
  document_requested: 'notificationList.type.request',
  document_request_fulfilled: 'notificationList.type.request',
  inbound_share_received: 'notificationList.type.inbound',
  inbound_share_accepted: 'notificationList.type.inbound',
  inbound_share_declined: 'notificationList.type.inbound',
  member_joined: 'notificationList.type.member',
};

/**
 * Título e corpo no idioma de quem lê.
 *
 * Notificação com `params` se remonta pelo catálogo; a gravada antes dele não tem `params` e
 * mostra o texto que ficou salvo.
 */
function notificationText(t: TFunction, notification: AppNotification): NotificationText {
  const stored = { title: notification.title, body: notification.body };
  if (!notification.params) return stored;
  return (
    renderNotificationText(notification.type, notification.params, {
      t: (key, values) => String(t(key, values)),
      formatCalendarDate: (value) => formatDate(value),
    }) ?? stored
  );
}

/**
 * Urgência sai dos dias restantes, não do marco configurado: o que importa para quem lê é quanto
 * tempo sobra, e o mesmo marco de 7 dias pode chegar com atraso.
 */
function expiryTone(daysRemaining: number): string {
  if (daysRemaining < 0) return 'text-doqyn-danger';
  if (daysRemaining <= 7) return 'text-doqyn-warning';
  return 'text-doqyn-subtle';
}

/**
 * Para onde o aviso leva.
 *
 * Todos iam para a Biblioteca, que é a lista dos documentos **da organização** — quem recebeu um
 * compartilhamento ou um pedido de assinatura não encontra o documento lá, e o clique terminava
 * numa lista sem o item. Cada tipo aponta para a lista onde aquele documento de fato aparece.
 */
function targetFor(notification: AppNotification): string | null {
  // Um pedido ainda sem documento é o caso normal: enquanto ninguém envia, não há arquivo. O aviso
  // leva à lista de pedidos, que é onde a pessoa faz alguma coisa a respeito.
  if (notification.type === 'document_requested') return '/requests';

  /**
   * O que chegou de fora ainda não é documento do acervo: o aviso leva à fila de aceite, não ao
   * documento. Mandar para a ficha daria um link que a autorização recusa — o aceite é justamente
   * o que ainda não aconteceu.
   */
  if (notification.type === 'inbound_share_received') return '/library/shared';

  // Pedido atendido de outra empresa vem sem `documentId` de propósito: o documento espera aceite,
  // e o link tem de levar à decisão, não a uma ficha que a autorização recusa.
  if (notification.type === 'document_request_fulfilled' && !notification.documentId) {
    return '/library/shared';
  }

  if (!notification.documentId) return null;
  const query = `?documentId=${encodeURIComponent(notification.documentId)}`;

  if (notification.type === 'document_shared') return `/library/shared${query}`;
  // Quem pediu alcança o documento pela concessão criada no cumprimento, não pela governança da
  // categoria — e a listagem principal não carrega grants. Mandar para `/library` cairia na
  // mesma lista sem o item que este aviso acabou de anunciar.
  if (notification.type === 'document_request_fulfilled') {
    return `/library/shared${query}`;
  }
  if (notification.type === 'signature_required') return `/library/signatures${query}`;
  // Aceito ou recusado, quem lê é quem enviou — e o documento é dele, na própria Biblioteca.
  if (
    notification.type === 'inbound_share_accepted' ||
    notification.type === 'inbound_share_declined'
  ) {
    return `/library${query}`;
  }
  return `/library${query}`;
}

function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return i18n.t('notifications:notificationList.moment.now');
  if (minutes < 60) return i18n.t('notifications:notificationList.moment.minutes', { n: minutes });
  if (minutes < 60 * 24) {
    return i18n.t('notifications:notificationList.moment.hours', { n: Math.round(minutes / 60) });
  }
  return formatDate(date);
}

export function NotificationList({
  notifications,
  isLoading,
  onMarkRead,
  onDismiss,
  compact = false,
}: NotificationListProps) {
  const { t } = useTranslation('notifications');

  if (isLoading) {
    return (
      <p className="p-4 text-caption text-doqyn-muted">
        {t('notificationList.carregandoNotificacoes')}
      </p>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title={t('notificationList.nadaPorAqui')}
        description={t('notificationList.documentosEnviadosVersoesNovas')}
      />
    );
  }

  return (
    <ul className="divide-y divide-doqyn-border-subtle/75">
      {notifications.map((notification) => {
        const daysRemaining = notification.expiry?.daysRemaining;
        const target = targetFor(notification);
        const { title, body } = notificationText(t, notification);

        return (
          <li
            key={notification.id}
            className={cn(
              'flex items-start gap-3',
              // No sino o espaço é de 24rem e a lista precisa caber inteira na vista; na página
              // o aviso pode respirar.
              compact ? 'px-3 py-2' : 'p-3',
              notification.status === 'unread' && 'bg-doqyn-surface/60',
            )}
          >
            <span
              className={cn(
                'mt-0.5 shrink-0',
                daysRemaining === undefined ? 'text-doqyn-subtle' : expiryTone(daysRemaining),
              )}
              aria-hidden
            >
              <Icon name={TYPE_ICON[notification.type]} size={ICON_SIZE.sm} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="register-label text-doqyn-subtle">
                  {t(TYPE_LABEL_KEYS[notification.type])}
                </span>
                <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
                  {formatMoment(notification.createdAt)}
                </span>
                {notification.categoryName && !compact ? (
                  <span className="text-caption text-doqyn-muted">{notification.categoryName}</span>
                ) : null}
              </div>

              {target ? (
                <Link
                  to={target}
                  className={cn(
                    'block text-label text-doqyn-text underline-offset-4 hover:underline',
                    // Uma linha por campo no sino. Com `line-clamp-2` nos dois, um aviso ocupava
                    // cinco linhas e três deles já enchiam o painel — a lista deixava de ser lista
                    // e virava parede de texto. Na página inteira o título aparece completo.
                    compact ? 'truncate' : 'mt-1 break-words',
                  )}
                  onClick={() => {
                    if (notification.status === 'unread') onMarkRead(notification.id);
                  }}
                >
                  {title}
                </Link>
              ) : (
                <p
                  className={cn(
                    'text-label text-doqyn-text',
                    compact ? 'truncate' : 'mt-1 break-words',
                  )}
                >
                  {title}
                </p>
              )}

              {body ? (
                <p
                  className={cn(
                    'text-caption text-doqyn-muted',
                    compact ? 'truncate' : 'mt-0.5 break-words',
                  )}
                >
                  {body}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {notification.status === 'unread' ? (
                <IconButton
                  label={t('notificationList.marcarComoLida')}
                  onClick={() => onMarkRead(notification.id)}
                >
                  <Icon name="mark_email_read" size={ICON_SIZE.xs} />
                </IconButton>
              ) : null}
              <IconButton
                label={t('notificationList.dispensar')}
                onClick={() => onDismiss(notification.id)}
              >
                <Icon name="close" size={ICON_SIZE.xs} />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
