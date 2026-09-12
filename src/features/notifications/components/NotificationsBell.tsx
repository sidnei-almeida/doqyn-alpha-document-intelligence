import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationList } from './NotificationList';
import { useTranslation } from 'react-i18next';

/** Acima disto o contador vira "9+" — o objetivo é sinalizar acúmulo, não a contagem exata. */
const BADGE_CAP = 9;

export function NotificationsBell({ className }: { className?: string }) {
  const { t } = useTranslation('notifications');

  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Só não lidas: sem o filtro, "Dispensar" não removia o item da lista e a ação parecia não
  // fazer nada.
  const { notifications, unreadCount, isLoading, markRead, dismiss, markAllRead } =
    useNotifications({
      status: 'unread',
      limit: 10,
    });

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={className}
        aria-label={
          unreadCount > 0
            ? t('notificationsBell.ariaUnread', { count: unreadCount })
            : t('notificationsBell.aria')
        }
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative inline-flex">
          <Icon name="notifications" size={ICON_SIZE.nav} />
          {unreadCount > 0 && (
            <span
              // Disco vermelho é a forma de outro sistema: aqui contagem é
              // registro — etiqueta de canto reto, monoespaçada e tabular.
              className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-[2px] bg-doqyn-danger-bg px-1 font-mono text-micro font-medium tabular-nums leading-none text-doqyn-danger"
              aria-hidden="true"
            >
              {unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : unreadCount}
            </span>
          )}
        </span>
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden"
        // O popover rola sozinho por padrão. Aqui ele tem cabeçalho e rodapé próprios: se o
        // painel inteiro rolasse, "Marcar tudo como lido" e "Ver todas" subiriam junto com a
        // lista — e a lista rolando dentro de um painel que também rola dava dois scrolls.
        panelStyle={{ overflowY: 'hidden' }}
        role="dialog"
        aria-label={t('notificationsBell.notificacoes')}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-doqyn-border-subtle px-3 py-2">
          <p className="register-label text-doqyn-subtle">{t('notificationsBell.notificacoes2')}</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-caption text-doqyn-muted underline-offset-4 transition-colors hover:text-doqyn-text hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
            >
              {t('notificationsBell.marcarTudoComoLido')}
            </button>
          )}
        </div>

        {/* `overflow-x-hidden` explícito: com um eixo em `auto` e o outro em `visible`, o
            navegador promove o `visible` para `auto` — e aparecia uma barra horizontal por
            causa dos títulos longos. */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            onMarkRead={markRead}
            onDismiss={dismiss}
            compact
          />
        </div>

        {/* Ir para a lista completa é navegação, não decisão: link de texto,
            não um botão de largura total dentro de um popover de 24rem. */}
        <div className="flex shrink-0 justify-end border-t border-doqyn-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate('/notificacoes');
            }}
            className="text-caption text-doqyn-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
          >
            {t('notificationsBell.verTodas')}
          </button>
        </div>
      </AnchoredPopover>
    </>
  );
}
