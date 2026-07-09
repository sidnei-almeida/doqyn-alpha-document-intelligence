import { useContext } from 'react';
import { useAuth } from '@/auth/useAuth';
import type { DocumentListItem } from '@/types/document-library';
import { ExplorerActionsContext } from '../context/explorerActionsContext';
import { useFavorites } from './useFavorites';
import { documentIsFavorite } from '../utils/documentIsFavorite';

/**
 * Favorito visível em qualquer view — sempre escopado ao usuário logado.
 * O backend grava em `user_document_favorites` por userId; `isFavorite` na listagem
 * também vem dessa preferência pessoal, nunca de outros usuários do tenant.
 */
export function useDocumentIsFavorite(doc: DocumentListItem): boolean {
  const { isAuthenticated } = useAuth();
  const explorer = useContext(ExplorerActionsContext);
  const { resolveIsStarred } = useFavorites();

  if (!isAuthenticated) return false;

  if (explorer) {
    return documentIsFavorite(doc, explorer.isStarred);
  }

  return resolveIsStarred(doc.documentId, doc.isFavorite);
}
