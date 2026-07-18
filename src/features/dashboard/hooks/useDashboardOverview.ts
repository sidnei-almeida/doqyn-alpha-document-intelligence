import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import type { DashboardOverviewResponse, DashboardPeriodKey } from '@/types/dashboard-overview';
import { fetchDashboardOverview } from '../api/dashboardApi';

type UseDashboardOverviewOptions = Pick<
  UseQueryOptions<DashboardOverviewResponse>,
  'staleTime' | 'refetchInterval' | 'refetchOnWindowFocus' | 'refetchOnReconnect'
>;

/**
 * `liveSync` options (staleTime 5s, refetchInterval 20s) fazem sentido para a página do
 * Dashboard, mas são pesados demais para widgets que ficam montados em todas as rotas
 * (ex: SidebarStoragePanel) — passe `overrides` para relaxar o polling nesses casos.
 */
export function useDashboardOverview(
  period: DashboardPeriodKey = '30d',
  overrides?: UseDashboardOverviewOptions,
) {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['dashboard-overview', tenant?.tenantId, period],
    queryFn: () => fetchDashboardOverview({ period }),
    ...tenantLiveSyncQueryOptions(),
    ...overrides,
  });
}
