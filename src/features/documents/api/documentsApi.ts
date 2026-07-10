import { api } from '@/lib/api';
import type {
  DocumentDetailResponse,
  DocumentListFilters,
  DocumentListItem,
  DocumentListResponse,
  DocumentVersionSummary,
} from '@/types/document-library';
import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from './documentsApi.errors';

export { DocumentApiError } from './documentsApi.errors';
export {
  fetchDocumentPreviewBlob,
  fetchDocumentDownloadBlob,
  triggerBlobDownload,
} from './documentsApi.blobs';

export async function listDocuments(filters?: DocumentListFilters): Promise<DocumentListItem[]> {
  const result = await api.documents.list(filters as Record<string, string> | undefined);
  const response = result as DocumentListResponse;
  return response.items ?? response.documents ?? [];
}

export async function getDocument(documentId: string): Promise<DocumentDetailResponse> {
  const encodedId = encodeURIComponent(documentId);
  let response = await authFetch(`/api/documents/${encodedId}`);
  if (!response.ok && (response.status === 404 || response.status === 405)) {
    response = await authFetch(`/api/documents?id=${encodedId}`);
  }
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<DocumentDetailResponse>;
}

export async function getDocumentPreviewBlob(
  documentId: string,
  versionId?: string,
  trackView?: boolean,
): Promise<Blob> {
  const { fetchDocumentPreviewBlob } = await import('./documentsApi.blobs');
  return fetchDocumentPreviewBlob({ documentId, versionId, trackView });
}

export async function downloadDocument(
  documentId: string,
  versionId?: string,
): Promise<{ blob: Blob; fileName: string }> {
  const { fetchDocumentDownloadBlob } = await import('./documentsApi.blobs');
  return fetchDocumentDownloadBlob({ documentId, versionId });
}

export async function listDocumentVersions(documentId: string): Promise<{
  documentId: string;
  currentVersionId: string;
  currentVersionLabel: string;
  versionCount: number;
  versions: DocumentVersionSummary[];
}> {
  const encodedId = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encodedId}/versions`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json();
}

export async function transferDocumentOwnership(
  documentId: string,
  input: { newOwnerUserId: string; reason?: string },
): Promise<{
  ok: boolean;
  result: {
    documentId: string;
    previousOwnerUserId: string;
    previousOwnerName?: string;
    newOwnerUserId: string;
    newOwnerName: string;
    transferredAt: string;
  };
}> {
  const encodedId = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encodedId}/transfer-ownership`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json();
}

export async function fetchDocumentCategories(): Promise<
  Array<{ id: string; name: string; description?: string; slug?: string }>
> {
  const response = await authFetch('/api/document-categories');
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  const data = (await response.json()) as {
    categories?: Array<{ id: string; name: string; description?: string; slug?: string }>;
  };
  return data.categories ?? [];
}
