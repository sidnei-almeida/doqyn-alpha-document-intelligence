import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { listTrashDocuments } from '../api/trashApi';

export function useTrashDocuments(search?: string, enabled = true) {
  const { user, tenant, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['trash-documents', tenant?.tenantId, user?.id, search ?? ''],
    queryFn: () => listTrashDocuments(search),
    enabled: enabled && isAuthenticated && Boolean(tenant?.tenantId && user?.id),
    staleTime: 10_000,
  });
}
