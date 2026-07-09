import type { QueryClient } from '@tanstack/react-query';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';

/** Invalida listas, detalhe, versões, preview e favoritos após nova versão confirmada. */
export async function invalidateDocumentUpdateQueries(
  queryClient: QueryClient,
  tenantId: string | null | undefined,
  documentId: string,
): Promise<void> {
  await invalidateLibraryQueries(queryClient, tenantId);

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['document-detail', tenantId, documentId],
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: ['document-versions', documentId],
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: ['document-preview-manifest'],
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: ['document-thumbnail-blob'],
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: ['favorite-documents'],
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: ['dashboard-overview'],
      refetchType: 'all',
    }),
  ]);
}
