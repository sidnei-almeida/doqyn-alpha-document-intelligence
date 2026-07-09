import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getLibraryDefaultView } from '../utils/libraryDefaultView';
import { resolveCollection } from '../collections';
import type {
  LibraryOwnerFilter,
  LibraryPeriodKey,
  LibraryRouteState,
  LibrarySearchScope,
  LibrarySortDirection,
  LibrarySortKey,
  LibraryTypeFilter,
  LibraryViewMode,
} from '../types/library';

const VALID_VIEWS: LibraryViewMode[] = ['list', 'grid'];
const VALID_SORTS: LibrarySortKey[] = ['name', 'updatedAt', 'status', 'owner', 'category'];
const VALID_DIRECTIONS: LibrarySortDirection[] = ['asc', 'desc'];
const VALID_PERIODS: LibraryPeriodKey[] = ['', 'today', '7d', '30d', 'month'];
const VALID_TYPES: LibraryTypeFilter[] = ['', 'pdf', 'image', 'other'];
const VALID_OWNERS: LibraryOwnerFilter[] = ['', 'me', 'others'];
const VALID_SCOPES: LibrarySearchScope[] = ['', 'all'];

/**
 * Estado da Biblioteca vive na URL: coleção no path (/biblioteca/:collection)
 * e filtros em query para deep-link e refresh previsível.
 */
export function useLibraryRouteState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { collection: collectionSlug } = useParams<{ collection?: string }>();

  const collection = useMemo(() => resolveCollection(collectionSlug), [collectionSlug]);

  const state = useMemo<LibraryRouteState>(() => {
    const view = searchParams.get('view') as LibraryViewMode | null;
    const sort = searchParams.get('sort') as LibrarySortKey | null;
    const direction = searchParams.get('direction') as LibrarySortDirection | null;
    const period = searchParams.get('period') as LibraryPeriodKey | null;
    const type = searchParams.get('type') as LibraryTypeFilter | null;
    const owner = searchParams.get('owner') as LibraryOwnerFilter | null;
    const scope = searchParams.get('scope') as LibrarySearchScope | null;

    return {
      space: searchParams.get('space') ?? '',
      q: searchParams.get('q') ?? '',
      view: view && VALID_VIEWS.includes(view) ? view : getLibraryDefaultView(),
      sort: sort && VALID_SORTS.includes(sort) ? sort : 'updatedAt',
      direction: direction && VALID_DIRECTIONS.includes(direction) ? direction : 'desc',
      status: searchParams.get('status') ?? '',
      type: type && VALID_TYPES.includes(type) ? type : '',
      period: period && VALID_PERIODS.includes(period) ? period : '',
      owner: owner && VALID_OWNERS.includes(owner) ? owner : '',
      scope: scope && VALID_SCOPES.includes(scope) ? scope : '',
    };
  }, [searchParams]);

  const update = useCallback(
    (patch: Partial<LibraryRouteState>) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          for (const [key, value] of Object.entries(patch)) {
            if (value) {
              next.set(key, value);
            } else {
              next.delete(key);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    update({
      q: '',
      status: '',
      type: '',
      period: '',
      owner: '',
      scope: '',
    });
  }, [update]);

  return { state, update, clearFilters, collection };
}
