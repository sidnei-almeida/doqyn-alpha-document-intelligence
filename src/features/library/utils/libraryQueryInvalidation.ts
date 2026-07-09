import type { QueryClient } from '@tanstack/react-query';
import { logLibraryDev } from '@/features/upload/utils/uploadDevLog';

/**
 * Invalida e refetch imediato das queries da Biblioteca após confirm/upload.
 */
export async function invalidateLibraryQueries(
  queryClient: QueryClient,
  tenantId?: string | null,
): Promise<void> {
  const documentKey = tenantId ? (['documents', tenantId] as const) : (['documents'] as const);

  await queryClient.invalidateQueries({ queryKey: ['documents'], refetchType: 'all' });
  await queryClient.invalidateQueries({
    queryKey: ['favorite-documents'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['document-categories-options'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'], refetchType: 'all' });
  await queryClient.invalidateQueries({ queryKey: ['tracking-events'], refetchType: 'all' });

  const refetches = await Promise.allSettled([
    queryClient.refetchQueries({ queryKey: documentKey, type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['document-categories-options'], type: 'active' }),
  ]);

  logLibraryDev('documents:refetch-after-confirm', {
    tenantId: tenantId ?? null,
    documentsRefetch: refetches[0].status,
    categoriesRefetch: refetches[1].status,
  });
}
