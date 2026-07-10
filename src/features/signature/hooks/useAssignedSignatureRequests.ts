import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { fetchAssignedSignatureRequests } from '@/features/signature/api/signatureApi';

export function useAssignedSignatureRequests(enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['assigned-signature-requests', user?.id],
    queryFn: () => fetchAssignedSignatureRequests(),
    enabled: Boolean(enabled && user?.id),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasPending = items.some(
        (item) => item.status === 'pending' || item.signerStatus === 'pending',
      );
      return hasPending ? 10_000 : false;
    },
  });
}
