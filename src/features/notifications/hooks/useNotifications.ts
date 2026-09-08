import { i18n } from '@/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import {
  listNotifications,
  markAllNotificationsRead,
  updateNotification,
  type NotificationStatus,
} from '../api/notificationsApi';

const NOTIFICATIONS_KEY = 'notifications';

/**
 * Caixa de notificações do usuário.
 *
 * A chave do cache inclui o tenant ativo: trocar de empresa não pode mostrar aviso da anterior.
 */
export function useNotifications(options?: { status?: NotificationStatus; limit?: number }) {
  const { tenant, user, isAuthenticated } = useAuth();
  const tenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const queryClient = useQueryClient();

  const queryKey = [NOTIFICATIONS_KEY, tenantId, options?.status ?? 'all', options?.limit ?? 50];

  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () => listNotifications(options),
    enabled: isAuthenticated && Boolean(tenantId),
    // Compartilhar e pedir assinatura acontecem enquanto a pessoa está com a tela aberta — meio
    // minuto é o intervalo em que o aviso ainda chega como reação, sem virar polling.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, tenantId] });
  };

  const updateStatus = useMutation({
    mutationFn: ({
      notificationId,
      status,
    }: {
      notificationId: string;
      status: 'read' | 'dismissed';
    }) => updateNotification(notificationId, status),
    onSuccess: invalidate,
    onError: () => toast.error(i18n.t('notifications:toast.falhaAtualizar')),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (result) => {
      invalidate();
      if (result.updated > 0) {
        toast.success(
          result.updated === 1
            ? '1 notificação marcada como lida.'
            : `${result.updated} notificações marcadas como lidas.`,
        );
      }
    },
    onError: () => toast.error(i18n.t('notifications:toast.falhaMarcarLidas')),
  });

  return {
    notifications: notificationsQuery.data?.items ?? [],
    unreadCount: notificationsQuery.data?.unreadCount ?? 0,
    isLoading: notificationsQuery.isLoading,
    isError: notificationsQuery.isError,
    refetch: notificationsQuery.refetch,
    markRead: (notificationId: string) => updateStatus.mutate({ notificationId, status: 'read' }),
    dismiss: (notificationId: string) =>
      updateStatus.mutate({ notificationId, status: 'dismissed' }),
    markAllRead: () => markAllRead.mutate(),
    isMutating: updateStatus.isPending || markAllRead.isPending,
  };
}
