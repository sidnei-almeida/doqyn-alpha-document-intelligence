import type { DocumentListItem } from '@/types/document-library';
import { formatDate } from '@/lib/utils';

export function documentDisplayName(doc: DocumentListItem): string {
  return doc.currentFileName ?? doc.displayName;
}

export function resolveDocumentVersionId(doc: DocumentListItem): string | undefined {
  return doc.latestVersionId ?? doc.currentVersionId;
}

export function documentCanPreview(doc: DocumentListItem): boolean {
  return doc.permissions?.canPreview !== false && Boolean(resolveDocumentVersionId(doc));
}

export function documentSecondaryMeta(
  doc: DocumentListItem,
  override?: string,
): string {
  if (override) return override;
  const category = doc.categoryName ?? doc.documentType ?? 'Sem pasta';
  return `${category} · ${formatDate(doc.updatedAt)}`;
}

export function documentOwnerName(doc: DocumentListItem): string {
  return doc.createdBy?.displayName ?? doc.ownerName ?? '—';
}
