import type { DocumentListItem } from '@/types/document-library';

/** Indica favorito a partir do payload da API e/ou estado otimista local. */
export function documentIsFavorite(
  doc: DocumentListItem,
  isStarred?: (documentId: string) => boolean,
): boolean {
  return doc.isFavorite === true || Boolean(isStarred?.(doc.documentId));
}
