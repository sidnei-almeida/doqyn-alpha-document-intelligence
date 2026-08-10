import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import {
  listExpiryAlerts,
  markAllExpiryAlertsRead,
  updateExpiryAlert,
  type ExpiryAlertStatus,
} from '../api/expiryApi';

const ALERTS_KEY = 'expiry-alerts';

/**
 * Caixa de alertas de vencimento do usuário.
 *
 * A chave do cache inclui o tenant ativo: trocar de empresa não pode mostrar alerta da anterior.
 */
export function useExpiryAlerts(options?: { status?: ExpiryAlertStatus; limit?: number }) {
  const { tenant, user, isAuthenticated } = useAuth();
  const tenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const queryClient = useQueryClient();

  const queryKey = [ALERTS_KEY, tenantId, options?.status ?? 'all', options?.limit ?? 50];

  const alertsQuery = useQuery({
    queryKey,
    queryFn: () => listExpiryAlerts(options),
    enabled: isAuthenticated && Boolean(tenantId),
    // A varredura roda uma vez por dia; refazer a consulta a cada minuto é desperdício.
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [ALERTS_KEY, tenantId] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ alertId, status }: { alertId: string; status: 'read' | 'dismissed' }) =>
      updateExpiryAlert(alertId, status),
    onSuccess: invalidate,
    onError: () => toast.error('Não foi possível atualizar o alerta. Tente novamente.'),
  });

  const markAllRead = useMutation({
    mutationFn: markAllExpiryAlertsRead,
    onSuccess: (result) => {
      invalidate();
      if (result.updated > 0) toast.success(`${result.updated} alerta(s) marcado(s) como lido(s).`);
    },
    onError: () => toast.error('Não foi possível marcar os alertas como lidos.'),
  });

  return {
    alerts: alertsQuery.data?.items ?? [],
    unreadCount: alertsQuery.data?.unreadCount ?? 0,
    isLoading: alertsQuery.isLoading,
    isError: alertsQuery.isError,
    refetch: alertsQuery.refetch,
    markRead: (alertId: string) => updateStatus.mutate({ alertId, status: 'read' }),
    dismiss: (alertId: string) => updateStatus.mutate({ alertId, status: 'dismissed' }),
    markAllRead: () => markAllRead.mutate(),
    isMutating: updateStatus.isPending || markAllRead.isPending,
  };
}
