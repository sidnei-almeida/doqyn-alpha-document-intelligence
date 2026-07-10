import type { QueryClient } from '@tanstack/react-query';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';

export async function invalidateSignatureQueries(
  queryClient: QueryClient,
  tenantId?: string | null,
): Promise<void> {
  await invalidateLibraryQueries(queryClient, tenantId);
  await queryClient.invalidateQueries({
    queryKey: ['document-signature-requests'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['assigned-signature-requests'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['document-detail'],
    refetchType: 'all',
  });
}
