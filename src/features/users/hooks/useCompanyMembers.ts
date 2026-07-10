import { useQuery } from '@tanstack/react-query';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import { usersApi } from '../api/usersApi';

export function useCompanyMembers(tenantId: string) {
  return useQuery({
    queryKey: ['company-members', tenantId],
    queryFn: () => usersApi.list(),
    enabled: Boolean(tenantId),
    ...tenantLiveSyncQueryOptions(),
  });
}
