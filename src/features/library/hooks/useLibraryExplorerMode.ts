import type { LibraryCollection } from '../collections';
import type { LibraryRouteState } from '../types/library';
import { hasActiveLibraryFilters } from '../utils/libraryFilterUtils';

export type LibraryExplorerMode = {
  /** Coleção principal da Biblioteca (não recentes/lixeira/etc.). */
  isRootCollection: boolean;
  /** Dentro de uma pasta inteligente (?space=). */
  isInsideFolder: boolean;
  /** Raiz estilo “Meu Drive”: pastas em destaque, sem tabela administrativa. */
  isBrowseRoot: boolean;
  /** Busca ou filtro de status na raiz — mostra arquivos correspondentes. */
  isSearchOrFilterAtRoot: boolean;
  /** Coleções virtuais (recentes, favoritos, …). */
  isVirtualCollection: boolean;
};

/**
 * Deriva o modo de navegação do File Explorer a partir da rota atual.
 * Mantém ?space= como identificador de pasta (categoria) — opção A, compatível com o app.
 */
export function useLibraryExplorerMode(
  state: LibraryRouteState,
  collection: LibraryCollection,
): LibraryExplorerMode {
  const isRootCollection = collection.id === 'root';
  const isInsideFolder = isRootCollection && Boolean(state.space);
  const isSearchOrFilterAtRoot =
    isRootCollection && !state.space && hasActiveLibraryFilters(state);
  const isBrowseRoot = isRootCollection && !state.space && !isSearchOrFilterAtRoot;
  const isVirtualCollection = !isRootCollection;

  return {
    isRootCollection,
    isInsideFolder,
    isBrowseRoot,
    isSearchOrFilterAtRoot,
    isVirtualCollection,
  };
}
