import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import { fetchDocumentCategories } from '../api/libraryApi';
import type { LibraryFolder } from '../types/library';

export function useDocumentCategories() {
  return useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
  });
}

/**
 * Pastas inteligentes: categorias do tenant com contagem derivada dos
 * documentos já carregados (evita N chamadas de count por categoria).
 */
export function useCategoryFolders(documents: DocumentListItem[]): {
  folders: LibraryFolder[];
  isLoading: boolean;
} {
  const { data: categories = [], isLoading } = useDocumentCategories();

  const folders = useMemo<LibraryFolder[]>(() => {
    const countByCategory = new Map<string, number>();
    for (const doc of documents) {
      if (!doc.categoryId) continue;
      countByCategory.set(doc.categoryId, (countByCategory.get(doc.categoryId) ?? 0) + 1);
    }
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      documentCount: countByCategory.get(category.id) ?? 0,
    }));
  }, [categories, documents]);

  return { folders, isLoading };
}
