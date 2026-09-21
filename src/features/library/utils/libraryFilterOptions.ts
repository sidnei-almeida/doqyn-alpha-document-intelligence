/**
 * As opções dos filtros da Biblioteca.
 *
 * São constante de módulo, então guardam `labelKey` e não a frase: o módulo carrega uma vez, e
 * uma frase resolvida aqui ficaria presa ao idioma daquele instante. Quem monta o menu chama
 * `resolveFilterOptions` com o `t` do próprio componente, que já re-renderiza na troca de idioma.
 *
 * A extração corrigiu um defeito de tela: o rótulo de status vinha de `DOCUMENT_STATUSES[...]`,
 * que desde a migração de `src/lib/constants.ts` guarda **chave**, não texto. O filtro mostrava
 * `common:documentStatus.active` para o usuário, e `archived` — que nem existe naquele mapa —
 * caía no próprio identificador. Agora as cinco frases estão escritas aqui, no catálogo.
 */
import type { TFunction } from 'i18next';
import type {
  LibraryOwnerFilter,
  LibraryPeriodKey,
  LibrarySortDirection,
  LibrarySortKey,
  LibraryTypeFilter,
} from '../types/library';

export type FilterOption<TValue extends string> = { value: TValue; labelKey: string };

/** Resolve a lista para o formato que os menus esperam: `{ value, label }`. */
export function resolveFilterOptions<TValue extends string>(
  options: ReadonlyArray<FilterOption<TValue>>,
  t: TFunction,
): Array<{ value: TValue; label: string }> {
  return options.map((option) => ({ value: option.value, label: t(option.labelKey) }));
}

export const LIBRARY_STATUS_FILTER_VALUES = [
  'active',
  'processed',
  'analyzing',
  'pending_review',
  'archived',
] as const;

/* As chaves vão por extenso, e não montadas a partir de `LIBRARY_STATUS_FILTER_VALUES`: chave
   montada some da auditoria, que só enxerga literal. O `satisfies` prende as duas listas — tirar
   um status de lá sem tirar daqui não compila. */
export const STATUS_FILTER_OPTIONS: Array<FilterOption<string>> = [
  { value: '', labelKey: 'library:filterOption.status.all' },
  { value: 'active', labelKey: 'library:filterOption.status.active' },
  { value: 'processed', labelKey: 'library:filterOption.status.processed' },
  { value: 'analyzing', labelKey: 'library:filterOption.status.analyzing' },
  { value: 'pending_review', labelKey: 'library:filterOption.status.pending_review' },
  { value: 'archived', labelKey: 'library:filterOption.status.archived' },
] satisfies Array<FilterOption<'' | (typeof LIBRARY_STATUS_FILTER_VALUES)[number]>>;

export const TYPE_FILTER_OPTIONS: Array<FilterOption<LibraryTypeFilter>> = [
  { value: '', labelKey: 'library:filterOption.type.all' },
  { value: 'pdf', labelKey: 'library:filterOption.type.pdf' },
  { value: 'image', labelKey: 'library:filterOption.type.image' },
  { value: 'other', labelKey: 'library:filterOption.type.other' },
];

export const PERIOD_FILTER_OPTIONS: Array<FilterOption<LibraryPeriodKey>> = [
  { value: '', labelKey: 'library:filterOption.period.all' },
  { value: 'today', labelKey: 'library:filterOption.period.today' },
  { value: '7d', labelKey: 'library:filterOption.period.7d' },
  { value: '30d', labelKey: 'library:filterOption.period.30d' },
  { value: 'month', labelKey: 'library:filterOption.period.month' },
];

export const OWNER_FILTER_OPTIONS: Array<FilterOption<LibraryOwnerFilter>> = [
  { value: '', labelKey: 'library:filterOption.owner.all' },
  { value: 'me', labelKey: 'library:filterOption.owner.me' },
  { value: 'others', labelKey: 'library:filterOption.owner.others' },
];

export type LibrarySortOption = {
  sort: LibrarySortKey;
  direction: LibrarySortDirection;
  labelKey: string;
};

export const SORT_FILTER_OPTIONS: LibrarySortOption[] = [
  { sort: 'updatedAt', direction: 'desc', labelKey: 'library:filterOption.sort.updatedAtDesc' },
  { sort: 'updatedAt', direction: 'asc', labelKey: 'library:filterOption.sort.updatedAtAsc' },
  { sort: 'name', direction: 'asc', labelKey: 'library:filterOption.sort.nameAsc' },
  { sort: 'name', direction: 'desc', labelKey: 'library:filterOption.sort.nameDesc' },
  { sort: 'category', direction: 'asc', labelKey: 'library:filterOption.sort.category' },
  { sort: 'status', direction: 'asc', labelKey: 'library:filterOption.sort.status' },
  { sort: 'owner', direction: 'asc', labelKey: 'library:filterOption.sort.owner' },
];

export const SORT_FALLBACK_LABEL_KEY = 'library:filterOption.sort.fallback';

export function encodeSortOptionValue(
  sort: LibrarySortKey,
  direction: LibrarySortDirection,
): string {
  return `${sort}:${direction}`;
}

export function decodeSortOptionValue(value: string): LibrarySortOption | null {
  const match = SORT_FILTER_OPTIONS.find(
    (option) => encodeSortOptionValue(option.sort, option.direction) === value,
  );
  return match ?? null;
}

export function resolveSortOptionLabelKey(
  sort: LibrarySortKey,
  direction: LibrarySortDirection,
): string {
  return (
    SORT_FILTER_OPTIONS.find((option) => option.sort === sort && option.direction === direction)
      ?.labelKey ?? SORT_FALLBACK_LABEL_KEY
  );
}
