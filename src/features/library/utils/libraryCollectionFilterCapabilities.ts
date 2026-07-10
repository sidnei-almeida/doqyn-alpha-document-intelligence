import type { LibraryCollectionId } from '../collections';
import type { LibraryRouteState } from '../types/library';

export type LibraryCollectionFilterCapabilities = {
  status: boolean;
  type: boolean;
  period: boolean;
  owner: boolean;
  sort: boolean;
  view: boolean;
};

const FULL_CAPABILITIES: LibraryCollectionFilterCapabilities = {
  status: true,
  type: true,
  period: true,
  owner: true,
  sort: true,
  view: true,
};

/** Filtros disponíveis por coleção — alinhados ao endpoint/dados reais. */
export function resolveCollectionFilterCapabilities(
  collectionId: LibraryCollectionId,
): LibraryCollectionFilterCapabilities {
  switch (collectionId) {
    case 'para-assinar':
      return {
        status: false,
        type: false,
        period: false,
        owner: false,
        sort: false,
        view: false,
      };
    case 'lixeira':
    case 'compartilhados':
    case 'favoritos':
      return {
        status: false,
        type: false,
        period: false,
        owner: false,
        sort: true,
        view: true,
      };
    case 'recentes':
      return FULL_CAPABILITIES;
    case 'root':
    default:
      return FULL_CAPABILITIES;
  }
}

/** Remove da URL filtros que não se aplicam à coleção atual. */
export function pruneUnsupportedLibraryFilters(
  state: LibraryRouteState,
  collectionId: LibraryCollectionId,
): Partial<LibraryRouteState> | null {
  const caps = resolveCollectionFilterCapabilities(collectionId);
  const patch: Partial<LibraryRouteState> = {};

  if (!caps.status && state.status) patch.status = '';
  if (!caps.type && state.type) patch.type = '';
  if (!caps.period && state.period) patch.period = '';
  if (!caps.owner && state.owner) patch.owner = '';
  if (!caps.sort && (state.sort !== 'updatedAt' || state.direction !== 'desc')) {
    patch.sort = 'updatedAt';
    patch.direction = 'desc';
  }

  return Object.keys(patch).length ? patch : null;
}
