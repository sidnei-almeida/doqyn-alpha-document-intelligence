import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import type { DocumentDetailResponse, DocumentListFilters, DocumentListItem } from '@/types/document-library';
import { getDocument, listDocuments } from '../api/documentsApi';

export function useDocuments(filters: DocumentListFilters) {
  const { tenant } = useAuth();

  return useQuery<DocumentListItem[]>({
    queryKey: ['documents', tenant?.tenantId, filters],
    queryFn: () => listDocuments(filters),
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
