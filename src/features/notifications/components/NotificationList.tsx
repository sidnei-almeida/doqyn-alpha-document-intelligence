import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType } from '../api/notificationsApi';

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
};

const TYPE_LABEL: Record<NotificationType, string> = {
  document_expiring: 'vencimento',
  document_created: 'novo documento',
  document_updated: 'nova versão',
  signature_required: 'assinatura',
  document_shared: 'compartilhado',
  access_approved: 'acesso',
  access_rejected: 'acesso',
};

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
  if (!notification.documentId) return null;
  const query = `?documentId=${encodeURIComponent(notification.documentId)}`;

  if (notification.type === 'document_shared') return `/biblioteca/compartilhados${query}`;
  if (notification.type === 'signature_required') return `/biblioteca/assinaturas${query}`;
  return `/biblioteca${query}`;
}

function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 60 * 24) return `há ${Math.round(minutes / 60)} h`;
  return date.toLocaleDateString('pt-BR');
}

export function NotificationList({
  notifications,
  isLoading,
  onMarkRead,
  onDismiss,
  compact = false,
}: NotificationListProps) {
  if (isLoading) {
    return <p className="p-4 text-caption text-doqyn-muted">Carregando notificações…</p>;
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Nada por aqui"
        description="Documentos enviados, versões novas, pedidos de assinatura, compartilhamentos e vencimentos aparecem nesta caixa."
      />
    );
  }

  return (
    <ul className="divide-y divide-doqyn-border-subtle/75">
      {notifications.map((notification) => {
        const daysRemaining = notification.expiry?.daysRemaining;
        const target = targetFor(notification);

        return (
          <li
            key={notification.id}
            className={cn(
              'flex items-start gap-3 p-3',
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
                  {TYPE_LABEL[notification.type]}
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
                    'mt-1 block break-words text-label text-doqyn-text underline-offset-4 hover:underline',
                    // No sino o espaço é de 24rem: título de quatro linhas empurra o resto da
                    // lista para fora da vista. Na página inteira o título aparece completo.
                    compact && 'line-clamp-2',
                  )}
                  onClick={() => {
                    if (notification.status === 'unread') onMarkRead(notification.id);
                  }}
                >
                  {notification.title}
                </Link>
              ) : (
                <p
                  className={cn(
                    'mt-1 break-words text-label text-doqyn-text',
                    compact && 'line-clamp-2',
                  )}
                >
                  {notification.title}
                </p>
              )}

              {notification.body ? (
                <p
                  className={cn(
                    'mt-0.5 break-words text-caption text-doqyn-muted',
                    compact && 'line-clamp-2',
                  )}
                >
                  {notification.body}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {notification.status === 'unread' ? (
                <IconButton label="Marcar como lida" onClick={() => onMarkRead(notification.id)}>
                  <Icon name="mark_email_read" size={ICON_SIZE.xs} />
                </IconButton>
              ) : null}
              <IconButton label="Dispensar" onClick={() => onDismiss(notification.id)}>
                <Icon name="close" size={ICON_SIZE.xs} />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
