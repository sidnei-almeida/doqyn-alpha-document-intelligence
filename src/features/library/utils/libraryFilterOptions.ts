import { DOCUMENT_STATUSES } from '@/lib/constants';
import type {
  LibraryOwnerFilter,
  LibraryPeriodKey,
  LibrarySortDirection,
  LibrarySortKey,
  LibraryTypeFilter,
} from '../types/library';

export const LIBRARY_STATUS_FILTER_VALUES = [
  'active',
  'processed',
  'analyzing',
  'pending_review',
  'archived',
] as const;

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  ...LIBRARY_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label:
      value === 'pending_review'
        ? 'Requer revisão'
        : (DOCUMENT_STATUSES[value as keyof typeof DOCUMENT_STATUSES]?.label ?? value),
  })),
];

export const TYPE_FILTER_OPTIONS: Array<{ value: LibraryTypeFilter; label: string }> = [
  { value: '', label: 'Todos os tipos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagem' },
  { value: 'other', label: 'Outros' },
];

export const PERIOD_FILTER_OPTIONS: Array<{ value: LibraryPeriodKey; label: string }> = [
  { value: '', label: 'Qualquer data' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Este mês' },
];

export const OWNER_FILTER_OPTIONS: Array<{ value: LibraryOwnerFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'me', label: 'Eu' },
  { value: 'others', label: 'Outros usuários' },
];

export type LibrarySortOption = {
  sort: LibrarySortKey;
  direction: LibrarySortDirection;
  label: string;
};

export const SORT_FILTER_OPTIONS: LibrarySortOption[] = [
  { sort: 'updatedAt', direction: 'desc', label: 'Mais recentes' },
  { sort: 'updatedAt', direction: 'asc', label: 'Mais antigos' },
  { sort: 'name', direction: 'asc', label: 'Nome A–Z' },
  { sort: 'name', direction: 'desc', label: 'Nome Z–A' },
  { sort: 'category', direction: 'asc', label: 'Categoria' },
  { sort: 'status', direction: 'asc', label: 'Status' },
  { sort: 'owner', direction: 'asc', label: 'Proprietário' },
];

export function encodeSortOptionValue(sort: LibrarySortKey, direction: LibrarySortDirection): string {
  return `${sort}:${direction}`;
}

export function decodeSortOptionValue(value: string): LibrarySortOption | null {
  const match = SORT_FILTER_OPTIONS.find(
    (option) => encodeSortOptionValue(option.sort, option.direction) === value,
  );
  return match ?? null;
}

export function resolveSortOptionLabel(sort: LibrarySortKey, direction: LibrarySortDirection): string {
  return (
    SORT_FILTER_OPTIONS.find((option) => option.sort === sort && option.direction === direction)
      ?.label ?? 'Ordenação'
  );
}
