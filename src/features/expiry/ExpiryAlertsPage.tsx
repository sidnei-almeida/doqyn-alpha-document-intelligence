import { useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { useExpiryAlerts } from './hooks/useExpiryAlerts';
import { ExpiryAlertList } from './components/ExpiryAlertList';
import type { ExpiryAlertStatus } from './api/expiryApi';

const FILTERS: Array<{ value: ExpiryAlertStatus | 'all'; label: string }> = [
  { value: 'unread', label: 'Não lidos' },
  { value: 'all', label: 'Todos' },
  { value: 'dismissed', label: 'Dispensados' },
];

export function ExpiryAlertsPage() {
  const [filter, setFilter] = useState<ExpiryAlertStatus | 'all'>('unread');
  const { alerts, unreadCount, isLoading, markRead, dismiss, markAllRead } = useExpiryAlerts({
    status: filter === 'all' ? undefined : filter,
    limit: 200,
  });

  return (
    <PageShell
      title="Vencimentos"
      description="Documentos com vencimento próximo, segundo os alertas configurados por categoria."
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? 'secondary' : 'ghost'}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {unreadCount > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => markAllRead()}>
            Marcar tudo como lido
          </Button>
        )}
      </div>

      <div className="border-border rounded-lg border">
        <ExpiryAlertList
          alerts={alerts}
          isLoading={isLoading}
          onMarkRead={markRead}
          onDismiss={dismiss}
        />
      </div>
    </PageShell>
  );
}
