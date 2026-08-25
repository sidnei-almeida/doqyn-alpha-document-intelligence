import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useExpiryAlerts } from '../hooks/useExpiryAlerts';
import { ExpiryAlertList } from './ExpiryAlertList';

/** Acima disto o contador vira "9+" — o objetivo é sinalizar acúmulo, não a contagem exata. */
const BADGE_CAP = 9;

export function ExpiryAlertsBell({ className }: { className?: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Só não lidos: sem o filtro, "Dispensar" não removia o alerta da lista e a ação parecia
  // não fazer nada.
  const { alerts, unreadCount, isLoading, markRead, dismiss, markAllRead } = useExpiryAlerts({
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
            ? `Alertas de vencimento (${unreadCount} não lidos)`
            : 'Alertas de vencimento'
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
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden"
        role="dialog"
        aria-label="Alertas de vencimento"
      >
        <div className="flex items-center justify-between gap-2 border-b border-doqyn-border-subtle px-3 py-2">
          <p className="register-label text-doqyn-subtle">Vencimentos</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-caption text-doqyn-muted underline-offset-4 transition-colors hover:text-doqyn-text hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
            >
              Marcar tudo como lido
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          <ExpiryAlertList
            alerts={alerts}
            isLoading={isLoading}
            onMarkRead={markRead}
            onDismiss={dismiss}
            compact
          />
        </div>

        {/* Ir para a lista completa é navegação, não decisão: link de texto,
            não um botão de largura total dentro de um popover de 24rem. */}
        <div className="flex justify-end border-t border-doqyn-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate('/vencimentos');
            }}
            className="text-caption text-doqyn-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
          >
            Ver todos
          </button>
        </div>
      </AnchoredPopover>
    </>
  );
}
