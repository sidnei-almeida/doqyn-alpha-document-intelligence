import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { listDeactivatedDocuments } from '../api/deactivatedApi';

export function useDeactivatedDocuments(search?: string, enabled = true) {
  const { user, tenant, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['deactivated-documents', tenant?.tenantId, user?.id, search ?? ''],
    queryFn: () => listDeactivatedDocuments(search),
    enabled: enabled && isAuthenticated && Boolean(tenant?.tenantId && user?.id),
    staleTime: 10_000,
  });
}
