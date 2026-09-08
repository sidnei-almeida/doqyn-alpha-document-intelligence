import { useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { SegmentedTextToggle } from '@/components/ui/SegmentedTextToggle';
import { NotificationList } from './components/NotificationList';
import { useNotifications } from './hooks/useNotifications';
import type { NotificationStatus } from './api/notificationsApi';
import { useTranslation } from 'react-i18next';

const FILTERS: Array<{ value: NotificationStatus | 'all'; label: string }> = [
  { value: 'unread', label: 'Não lidas' },
  { value: 'all', label: 'Todas' },
  { value: 'dismissed', label: 'Dispensadas' },
];

export function NotificationsPage() {
  const { t } = useTranslation('notifications');

  const [filter, setFilter] = useState<NotificationStatus | 'all'>('unread');
  const { notifications, unreadCount, isLoading, markRead, dismiss, markAllRead } =
    useNotifications({
      status: filter === 'all' ? undefined : filter,
      limit: 200,
    });

  return (
    <PageShell
      eyebrow="Caixa"
      title={t('notificationsPage.notificacoes')}
      description={t('notificationsPage.documentosEnviadosVersoesNovas')}
      actions={
        unreadCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => markAllRead()}>
            {t('notificationsPage.marcarTudoComoLido')}
          </Button>
        ) : undefined
      }
    >
      <SegmentedTextToggle
        aria-label={t('notificationsPage.filtrarNotificacoes')}
        options={FILTERS}
        value={filter}
        onChange={setFilter}
      />

      <div className="border-t border-doqyn-border-subtle">
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onMarkRead={markRead}
          onDismiss={dismiss}
        />
      </div>
    </PageShell>
  );
}
