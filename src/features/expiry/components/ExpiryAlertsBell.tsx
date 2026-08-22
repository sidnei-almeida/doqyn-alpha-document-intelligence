import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
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
              className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
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
        className="border-border bg-popover w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border shadow-lg"
        role="dialog"
        aria-label="Alertas de vencimento"
      >
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Vencimentos</p>
          {unreadCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => markAllRead()}>
              Marcar tudo como lido
            </Button>
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

        <div className="border-border border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              void navigate('/vencimentos');
            }}
          >
            Ver todos
          </Button>
        </div>
      </AnchoredPopover>
    </>
  );
}
