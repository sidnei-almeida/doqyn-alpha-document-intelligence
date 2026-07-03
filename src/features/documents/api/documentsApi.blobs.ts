import { authFetch } from '@/auth/apiAuth';
import { DocumentApiError, parseDocumentApiError } from './documentsApi.errors';

export async function fetchDocumentPreviewBlob(input: {
  documentId: string;
  versionId?: string;
  trackView?: boolean;
}): Promise<Blob> {
  const query = new URLSearchParams({ documentId: input.documentId });
  if (input.versionId) query.set('versionId', input.versionId);
  if (input.trackView === false) query.set('trackView', 'false');

  const response = await authFetch(`/api/documents/preview?${query.toString()}`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  return response.blob();
}

export async function fetchDocumentDownloadBlob(input: {
  documentId: string;
  versionId?: string;
}): Promise<{ blob: Blob; fileName: string }> {
  const query = new URLSearchParams({
    documentId: input.documentId,
    disposition: 'attachment',
  });
  if (input.versionId) query.set('versionId', input.versionId);

  const response = await authFetch(`/api/documents/download?${query.toString()}`);
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] ?? 'documento.pdf';

  return {
    blob: await response.blob(),
    fileName,
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export { DocumentApiError };
