export type DocumentViewerKind = 'pdf' | 'image' | 'unsupported';

const PDF_MIME = 'application/pdf';

export function normalizeMimeType(mimeType: string | null | undefined): string {
  const normalized = (mimeType ?? '').trim().toLowerCase();
  if (!normalized) return PDF_MIME;
  return normalized;
}

export function resolveDocumentViewerKind(mimeType: string | null | undefined): DocumentViewerKind {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === PDF_MIME || normalized.endsWith('/pdf')) return 'pdf';
  if (normalized.startsWith('image/')) return 'image';
  return 'unsupported';
}

export function isPdfMimeType(mimeType: string | null | undefined): boolean {
  return resolveDocumentViewerKind(mimeType) === 'pdf';
}

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return resolveDocumentViewerKind(mimeType) === 'image';
}
