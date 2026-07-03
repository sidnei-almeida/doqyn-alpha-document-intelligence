import { authFetch } from '@/auth/apiAuth';
import type { DashboardOverviewResponse, DashboardPeriodKey } from '@/types/dashboard-overview';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export async function fetchDashboardOverview(input?: {
  period?: DashboardPeriodKey;
  from?: string;
  to?: string;
}): Promise<DashboardOverviewResponse> {
  const query = new URLSearchParams();
  if (input?.period) query.set('period', input.period);
  if (input?.from) query.set('from', input.from);
  if (input?.to) query.set('to', input.to);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await authFetch(`/api/dashboard/overview${suffix}`);

  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  return response.json() as Promise<DashboardOverviewResponse>;
}
