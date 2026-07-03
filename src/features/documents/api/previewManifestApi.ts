import { authFetch } from '@/auth/apiAuth';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import { parseDocumentApiError } from './documentsApi.errors';

export async function fetchPreviewManifest(input: {
  documentId: string;
  versionId: string;
  trackView?: boolean;
}): Promise<DocumentPreviewManifest> {
  const encodedDoc = encodeURIComponent(input.documentId);
  const encodedVer = encodeURIComponent(input.versionId);
  const query = input.trackView === false ? '?trackView=false' : '';
  const response = await authFetch(
    `/api/documents/${encodedDoc}/versions/${encodedVer}/preview/manifest${query}`,
  );

  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  return response.json() as Promise<DocumentPreviewManifest>;
}

export async function fetchPreviewAssetBlob(url: string): Promise<Blob> {
  const response = await authFetch(url);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.blob();
}
