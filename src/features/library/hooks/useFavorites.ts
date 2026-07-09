import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import type { DocumentListItem } from '@/types/document-library';
import {
  favoriteDocument,
  listFavoriteDocuments,
  unfavoriteDocument,
} from '../api/favoritesApi';

/**
 * Favoritos são preferência pessoal do usuário (userId), persistidos no MongoDB.
 */
export function useFavorites() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());

  const favoritesQuery = useQuery({
    queryKey: ['favorite-documents', userId],
    queryFn: listFavoriteDocuments,
    enabled: isAuthenticated && Boolean(userId),
    staleTime: 10_000,
  });

  const favoriteIdSet = useMemo(() => {
    const ids = new Set((favoritesQuery.data ?? []).map((doc) => doc.documentId));
    for (const [documentId, isFavorite] of optimistic) {
      if (isFavorite) ids.add(documentId);
      else ids.delete(documentId);
    }
    return ids;
  }, [favoritesQuery.data, optimistic]);

  const mutation = useMutation({
    mutationFn: async ({
      documentId,
      nextFavorite,
    }: {
      documentId: string;
      nextFavorite: boolean;
    }) => (nextFavorite ? favoriteDocument(documentId) : unfavoriteDocument(documentId)),
    onMutate: async ({ documentId, nextFavorite }) => {
      setOptimistic((current) => new Map(current).set(documentId, nextFavorite));
    },
    onError: () => {
      toast.error('Não foi possível atualizar os favoritos. Tente novamente.');
    },
    onSettled: async () => {
      setOptimistic(new Map());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['favorite-documents', userId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });

  const resolveIsStarred = useCallback(
    (documentId: string, docIsFavorite?: boolean) => {
      if (optimistic.has(documentId)) return optimistic.get(documentId)!;
      if (docIsFavorite !== undefined) return docIsFavorite;
      return favoriteIdSet.has(documentId);
    },
    [favoriteIdSet, optimistic],
  );

  const isStarred = useCallback(
    (documentId: string) => resolveIsStarred(documentId),
    [resolveIsStarred],
  );

  const toggleStar = useCallback(
    (documentId: string, currentIsFavorite?: boolean) => {
      const currentlyStarred = resolveIsStarred(documentId, currentIsFavorite);
      mutation.mutate({ documentId, nextFavorite: !currentlyStarred });
    },
    [mutation, resolveIsStarred],
  );

  return {
    starredIds: favoriteIdSet,
    favoriteDocuments: favoritesQuery.data ?? [],
    isLoadingFavorites: favoritesQuery.isLoading,
    toggleStar,
    isStarred,
    resolveIsStarred,
  };
}

export function useFavoriteDocuments(enabled: boolean) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<DocumentListItem[]>({
    queryKey: ['favorite-documents', userId],
    queryFn: listFavoriteDocuments,
    enabled: enabled && isAuthenticated && Boolean(userId),
    staleTime: 5_000,
  });
}
