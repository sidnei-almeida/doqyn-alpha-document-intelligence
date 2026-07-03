import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import { fetchDashboardOverview } from '../api/dashboardApi';

export function useDashboardOverview(period: DashboardPeriodKey = '30d') {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: ['dashboard-overview', tenant?.tenantId, period],
    queryFn: () => fetchDashboardOverview({ period }),
    staleTime: 30_000,
  });
}
