import { useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { applyCollectionFilter } from '../collections';
import { sortDocuments } from '../utils/sortDocuments';
import {
  buildLibraryDocumentFilters,
  libraryListScopeKey,
} from '../utils/libraryFilterUtils';
import { resolveLibraryCategoryId } from '../utils/resolveLibraryCategory';
import { useDocumentCategories } from './useCategoryFolders';
import { useFavoriteDocuments, useFavorites } from './useFavorites';
import { useLibraryRouteState } from './useLibraryRouteState';

/**
 * Container hook da Biblioteca: estado na URL + listDocuments com filtros reais.
 */
export function useLibraryView() {
  const { state, update, clearFilters, collection } = useLibraryRouteState();
  const { user } = useAuth();
  const { toggleStar, isStarred, resolveIsStarred } = useFavorites();
  const { data: categories = [] } = useDocumentCategories();
  const isFavoritesCollection = collection.id === 'favoritos';

  const resolvedSpaceId = useMemo(
    () => (state.space ? resolveLibraryCategoryId(state.space, categories) : ''),
    [state.space, categories],
  );

  useEffect(() => {
    if (!state.space || !categories.length) return;
    if (resolvedSpaceId && resolvedSpaceId !== state.space) {
      update({ space: resolvedSpaceId });
    }
  }, [state.space, resolvedSpaceId, categories.length, update]);

  const filters = useMemo(
    () =>
      buildLibraryDocumentFilters({
        state,
        collectionId: collection.id,
        currentUserId: user?.id,
        categories,
      }),
    [state, collection.id, user?.id, categories],
  );

  const listScopeKey = useMemo(() => libraryListScopeKey(filters), [filters]);

  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    isFetching: isFetchingDocuments,
    isError: isDocumentsError,
  } = useDocuments(filters, {
    listScopeKey,
    enabled: !isFavoritesCollection,
  });

  const {
    data: favoriteDocuments = [],
    isLoading: isLoadingFavorites,
    isFetching: isFetchingFavorites,
    isError: isFavoritesError,
  } = useFavoriteDocuments(isFavoritesCollection);

  const visibleDocuments = useMemo(() => {
    if (isFavoritesCollection) {
      return sortDocuments(favoriteDocuments, state.sort, state.direction);
    }

    const scoped = applyCollectionFilter(documents, collection, {
      currentUserId: user?.id,
    });
    if (collection.id === 'recentes') return scoped;
    return sortDocuments(scoped, state.sort, state.direction);
  }, [
    documents,
    favoriteDocuments,
    collection,
    user?.id,
    state.sort,
    state.direction,
    isFavoritesCollection,
  ]);

  return {
    state,
    update,
    clearFilters,
    collection,
    categories,
    resolvedSpaceId,
    documents: visibleDocuments,
    isLoading: isFavoritesCollection ? isLoadingFavorites : isLoadingDocuments,
    isFetching: isFavoritesCollection ? isFetchingFavorites : isFetchingDocuments,
    isError: isFavoritesCollection ? isFavoritesError : isDocumentsError,
    toggleStar,
    isStarred,
    resolveIsStarred,
  };
}
