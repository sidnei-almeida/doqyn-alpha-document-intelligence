import { useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { applyCollectionFilter, RECENT_LIMIT } from '../collections';
import { sortDocuments } from '../utils/sortDocuments';
import {
  buildLibraryDocumentFilters,
  libraryListScopeKey,
} from '../utils/libraryFilterUtils';
import { resolveLibraryCategoryId } from '../utils/resolveLibraryCategory';
import { useDocumentCategories } from './useCategoryFolders';
import { useFavoriteDocuments, useFavorites } from './useFavorites';
import { useTrashDocuments } from './useTrashDocuments';
import { useSharedWithMeDocuments } from '@/features/sharing/hooks/useSharedWithMeDocuments';
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
  const isTrashCollection = collection.id === 'lixeira';
  const isSharedCollection = collection.id === 'compartilhados';
  const isSignaturesCollection = collection.id === 'para-assinar';

  const resolvedSpaceId = useMemo(
    () => (state.space ? resolveLibraryCategoryId(state.space, categories) : ''),
    [state.space, categories],
  );

  useEffect(() => {
    if (!state.space || !categories.length) return;
    if (resolvedSpaceId && resolvedSpaceId !== state.space) {
      update({ space: resolvedSpaceId });
      return;
    }
    if (!resolvedSpaceId) {
      update({ space: '' });
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
    enabled: !isFavoritesCollection && !isTrashCollection && !isSharedCollection && !isSignaturesCollection,
  });

  const {
    data: trashDocuments = [],
    isLoading: isLoadingTrash,
    isFetching: isFetchingTrash,
    isError: isTrashError,
  } = useTrashDocuments(state.q.trim() || undefined, isTrashCollection);

  const {
    data: favoriteDocuments = [],
    isLoading: isLoadingFavorites,
    isFetching: isFetchingFavorites,
    isError: isFavoritesError,
  } = useFavoriteDocuments(isFavoritesCollection);

  const {
    data: sharedDocuments = [],
    isLoading: isLoadingShared,
    isFetching: isFetchingShared,
    isError: isSharedError,
  } = useSharedWithMeDocuments(state.q.trim() || undefined, isSharedCollection);

  const visibleDocuments = useMemo(() => {
    if (isTrashCollection) {
      return sortDocuments(trashDocuments, state.sort, state.direction);
    }

    if (isFavoritesCollection) {
      return sortDocuments(favoriteDocuments, state.sort, state.direction);
    }

    if (isSharedCollection) {
      return sortDocuments(sharedDocuments, state.sort, state.direction);
    }

    const scoped = applyCollectionFilter(documents, collection, {
      currentUserId: user?.id,
    });
    if (collection.id === 'recentes') {
      const sorted = sortDocuments(scoped, state.sort, state.direction);
      return sorted.slice(0, RECENT_LIMIT);
    }
    return sortDocuments(scoped, state.sort, state.direction);
  }, [
    documents,
    favoriteDocuments,
    trashDocuments,
    sharedDocuments,
    collection,
    user?.id,
    state.sort,
    state.direction,
    isFavoritesCollection,
    isTrashCollection,
    isSharedCollection,
  ]);

  return {
    state,
    update,
    clearFilters,
    collection,
    categories,
    resolvedSpaceId,
    documents: visibleDocuments,
    isLoading: isTrashCollection
      ? isLoadingTrash
      : isFavoritesCollection
        ? isLoadingFavorites
        : isSharedCollection
          ? isLoadingShared
          : isLoadingDocuments,
    isFetching: isTrashCollection
      ? isFetchingTrash
      : isFavoritesCollection
        ? isFetchingFavorites
        : isSharedCollection
          ? isFetchingShared
          : isFetchingDocuments,
    isError: isTrashCollection
      ? isTrashError
      : isFavoritesCollection
        ? isFavoritesError
        : isSharedCollection
          ? isSharedError
          : isDocumentsError,
    toggleStar,
    isStarred,
    resolveIsStarred,
  };
}
