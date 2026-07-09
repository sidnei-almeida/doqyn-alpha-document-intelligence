import { authFetch } from '@/auth/apiAuth';
import type { DocumentListItem, DocumentListResponse } from '@/types/document-library';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type FavoriteMutationResponse = {
  ok: boolean;
  documentId: string;
  isFavorite: boolean;
};

export async function listFavoriteDocuments(): Promise<DocumentListItem[]> {
  const response = await authFetch('/api/favorites/documents');
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  const data = (await response.json()) as DocumentListResponse;
  return data.items ?? data.documents ?? [];
}

export async function favoriteDocument(documentId: string): Promise<FavoriteMutationResponse> {
  const response = await authFetch(
    `/api/documents/${encodeURIComponent(documentId)}/favorite`,
    { method: 'POST' },
  );
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<FavoriteMutationResponse>;
}

export async function unfavoriteDocument(documentId: string): Promise<FavoriteMutationResponse> {
  const response = await authFetch(
    `/api/documents/${encodeURIComponent(documentId)}/favorite`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<FavoriteMutationResponse>;
}
