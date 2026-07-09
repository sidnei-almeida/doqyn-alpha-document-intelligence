import type { DocumentListFilters } from '@/types/document-library';
import type {
  LibraryPeriodKey,
  LibraryRouteState,
  LibrarySortDirection,
  LibrarySortKey,
} from '../types/library';
import {
  resolveLibraryCategoryId,
  type LibraryCategoryRef,
} from './resolveLibraryCategory';

export function mapStatusToApiFilters(status: string): Pick<
  DocumentListFilters,
  'status' | 'processingStatus'
> {
  switch (status) {
    case 'active':
      return { status: 'active' };
    case 'archived':
      return { status: 'archived' };
    case 'processed':
      return { status: 'active', processingStatus: 'processed' };
    case 'analyzing':
      return { processingStatus: 'pending' };
    case 'pending_review':
      return { processingStatus: 'requires_review' };
    case 'review_required':
      return { processingStatus: 'requires_review' };
    default:
      return {};
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function resolvePeriodRange(period: LibraryPeriodKey): { from?: string; to?: string } {
  if (!period) return {};
  const now = new Date();
  const to = endOfDay(now).toISOString();

  switch (period) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to };
    case '7d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: startOfDay(from).toISOString(), to };
    }
    case '30d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: startOfDay(from).toISOString(), to };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from).toISOString(), to };
    }
    default:
      return {};
  }
}

export function mapSortToApi(
  sort: LibrarySortKey,
  direction: LibrarySortDirection,
): Pick<DocumentListFilters, 'sort' | 'direction'> {
  return { sort, direction };
}

type BuildDocumentFiltersInput = {
  state: LibraryRouteState;
  collectionId: string;
  currentUserId?: string;
  categories?: readonly LibraryCategoryRef[];
};

/** Converte estado da URL em filtros estáveis para listDocuments. */
export function buildLibraryDocumentFilters({
  state,
  collectionId,
  currentUserId,
  categories = [],
}: BuildDocumentFiltersInput): DocumentListFilters {
  const statusFilters = mapStatusToApiFilters(state.status);
  const periodRange = resolvePeriodRange(state.period);
  const sortApi = mapSortToApi(state.sort, state.direction);

  const resolvedSpaceId = state.space
    ? resolveLibraryCategoryId(state.space, categories)
    : undefined;
  const insideFolder = collectionId === 'root' && Boolean(state.space);
  const searchEntireLibrary =
    insideFolder && state.scope === 'all' && Boolean(state.q.trim());

  const categoryId =
    collectionId === 'root' && resolvedSpaceId && !searchEntireLibrary
      ? resolvedSpaceId
      : undefined;

  const filters: DocumentListFilters = {
    search: state.q.trim() || undefined,
    categoryId,
    type: state.type || undefined,
    owner: state.owner || undefined,
    ...statusFilters,
    ...periodRange,
    ...sortApi,
    limit: '100',
  };

  if (state.owner === 'me' && currentUserId) {
    filters.owner = 'me';
  }
  if (state.owner === 'others' && currentUserId) {
    filters.owner = 'others';
  }

  // Raiz sem filtro de status: ocultar arquivados.
  if (collectionId === 'lixeira') {
    // Lixeira usa endpoint dedicado — não aplicar filtros de listDocuments.
  } else if (collectionId === 'root' && !state.status && !state.q) {
    filters.excludeArchived = 'true';
  }

  return filters;
}

/** Query key estável — objeto serializado com chaves ordenadas. */
export function serializeDocumentFilters(filters: DocumentListFilters): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
}

export function hasActiveLibraryFilters(state: LibraryRouteState): boolean {
  return Boolean(
    state.q.trim() ||
      state.status ||
      state.type ||
      state.period ||
      state.owner ||
      state.scope === 'all',
  );
}

/** Filtros de listagem que definem o recorte principal (pasta vs raiz). */
export function libraryListScopeKey(filters: DocumentListFilters): string {
  return JSON.stringify({
    categoryId: filters.categoryId ?? '',
    search: filters.search ?? '',
    status: filters.status ?? '',
    processingStatus: filters.processingStatus ?? '',
    type: filters.type ?? '',
    owner: filters.owner ?? '',
    from: filters.from ?? '',
    to: filters.to ?? '',
    excludeArchived: filters.excludeArchived ?? '',
  });
}
