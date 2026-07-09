import type { DocumentListItem } from '@/types/document-library';

const RECENT_LIMIT = 8;

/** Documentos mais recentes para a home da Biblioteca (dados reais, ordenados por updatedAt). */
export function pickRecentDocuments(
  documents: DocumentListItem[],
  limit = RECENT_LIMIT,
): DocumentListItem[] {
  return [...documents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function pickUncategorizedDocuments(documents: DocumentListItem[]): DocumentListItem[] {
  return documents.filter((doc) => !doc.categoryId);
}

export { RECENT_LIMIT };
