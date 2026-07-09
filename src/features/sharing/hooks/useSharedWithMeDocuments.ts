import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { fetchSharedWithMeDocuments } from '../api/shareApi';

export function useSharedWithMeDocuments(search?: string, enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shared-with-me', user?.id, search ?? ''],
    queryFn: () => fetchSharedWithMeDocuments(search),
    enabled: Boolean(enabled && user?.id),
    staleTime: 15_000,
  });
}
