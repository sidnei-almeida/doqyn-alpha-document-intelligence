import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import type { DocumentDetailResponse, DocumentListFilters, DocumentListItem } from '@/types/document-library';
import { documentHasPendingSignature } from '@/features/signature/utils/signatureSummaryDisplay';
import { serializeDocumentFilters } from '@/features/library/utils/libraryFilterUtils';
import { logLibraryDev } from '@/features/upload/utils/uploadDevLog';
import { getDocument, listDocuments } from '../api/documentsApi';

type UseDocumentsOptions = {
  /** Evita reutilizar cache visual entre pastas/filtros distintos. */
  listScopeKey?: string;
  enabled?: boolean;
};

export function useDocuments(filters: DocumentListFilters, options?: UseDocumentsOptions) {
  const { isAuthenticated, tenant, user } = useAuth();
  const tenantId = tenant?.tenantId ?? user?.companyId;
  const userId = user?.id ?? '';
  const serialized = serializeDocumentFilters(filters);
  const listScopeKey = options?.listScopeKey ?? serialized;

  return useQuery<DocumentListItem[]>({
    queryKey: ['documents', tenantId, userId, serialized, listScopeKey],
    queryFn: async () => {
      const items = await listDocuments(filters);
      logLibraryDev('documents:list-success', {
        tenantId: tenantId ?? null,
        userId: userId || null,
        count: items.length,
        scope: listScopeKey,
      });
      return items;
    },
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const items = query.state.data;
      if (!items?.some((doc) => documentHasPendingSignature(doc))) return false;
      return 10_000;
    },
  });
}

export function useDocumentDetail(documentId: string | null) {
  const { tenant } = useAuth();

  return useQuery<DocumentDetailResponse>({
    queryKey: ['document-detail', tenant?.tenantId, documentId],
    enabled: Boolean(documentId),
    queryFn: () => getDocument(documentId!),
  });
}
