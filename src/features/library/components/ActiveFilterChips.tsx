import type { TFunction } from 'i18next';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { LibraryRouteState } from '../types/library';
import type { LibraryCollectionFilterCapabilities } from '../utils/libraryCollectionFilterCapabilities';
import { hasActiveLibraryFilters } from '../utils/libraryFilterUtils';
import {
  OWNER_FILTER_OPTIONS,
  PERIOD_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  resolveSortOptionLabelKey,
} from '../utils/libraryFilterOptions';
import { useTranslation } from 'react-i18next';

type ActiveFilterChipsProps = {
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
  onClearAll: () => void;
  folderName?: string;
  filterCapabilities?: LibraryCollectionFilterCapabilities;
};

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation('library');

  return (
    <span className="explorer-filter-chip explorer-filter-chip--active inline-flex items-center gap-1 pr-1">
      <span className="max-w-[12rem] truncate">{label}</span>
      <button
        type="button"
        className="rounded-full p-0.5 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
        aria-label={t('activeFilterChips.removerFiltro', { label })}
        onClick={onRemove}
      >
        <Icon name="close" size={ICON_SIZE.xs} />
      </button>
    </span>
  );
}

/**
 * Acha a frase do valor ativo, ou cai no nome do próprio filtro.
 *
 * Recebe `t` em vez de resolver por dentro porque a lista guarda chave: o chip precisa da frase
 * do idioma corrente, e é o componente que re-renderiza quando ele muda.
 */
function labelFor(
  options: ReadonlyArray<{ value: string; labelKey: string }>,
  value: string,
  fallbackKey: string,
  t: TFunction,
): string {
  const match = options.find((option) => option.value === value);
  return t(match?.labelKey ?? fallbackKey);
}

/** Chips removíveis para busca e filtros ativos. */
export function ActiveFilterChips({
  state,
  onStateChange,
  onClearAll,
  folderName,
  filterCapabilities,
}: ActiveFilterChipsProps) {
  const { t } = useTranslation('library');

  const caps = filterCapabilities ?? {
    status: true,
    type: true,
    period: true,
    owner: true,
    sort: true,
    view: true,
  };

  if (!hasActiveLibraryFilters(state)) return null;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (state.q.trim()) {
    chips.push({
      key: 'q',
      label: t('activeFilterChips.busca', { query: state.q.trim() }),
      onRemove: () => onStateChange({ q: '' }),
    });
  }

  if (folderName && state.scope !== 'all') {
    chips.push({
      key: 'scope-folder',
      label: t('activeFilterChips.emPasta', { folderName }),
      onRemove: () => onStateChange({ scope: 'all' }),
    });
  }

  if (caps.status && state.status) {
    chips.push({
      key: 'status',
      label: labelFor(STATUS_FILTER_OPTIONS, state.status, 'library:filterFallback.status', t),
      onRemove: () => onStateChange({ status: '' }),
    });
  }

  if (caps.type && state.type) {
    chips.push({
      key: 'type',
      label: labelFor(TYPE_FILTER_OPTIONS, state.type, 'library:filterFallback.type', t),
      onRemove: () => onStateChange({ type: '' }),
    });
  }

  if (caps.period && state.period) {
    chips.push({
      key: 'period',
      label: labelFor(PERIOD_FILTER_OPTIONS, state.period, 'library:filterFallback.period', t),
      onRemove: () => onStateChange({ period: '' }),
    });
  }

  if (caps.owner && state.owner) {
    chips.push({
      key: 'owner',
      label: labelFor(OWNER_FILTER_OPTIONS, state.owner, 'library:filterFallback.owner', t),
      onRemove: () => onStateChange({ owner: '' }),
    });
  }

  if (state.scope === 'all' && folderName) {
    chips.push({
      key: 'scope-all',
      label: t('activeFilterChips.todaABiblioteca'),
      onRemove: () => onStateChange({ scope: '' }),
    });
  }

  const sortLabel = t(resolveSortOptionLabelKey(state.sort, state.direction));
  const isDefaultSort = state.sort === 'updatedAt' && state.direction === 'desc';
  if (caps.sort && !isDefaultSort) {
    chips.push({
      key: 'sort',
      label: sortLabel,
      onRemove: () => onStateChange({ sort: 'updatedAt', direction: 'desc' }),
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="library-active-filter-chips"
      role="group"
      aria-label={t('activeFilterChips.filtrosAtivos')}
    >
      {chips.map((chip) => (
        <RemovableChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
      ))}
      <button
        type="button"
        className="text-[12px] font-medium text-doqyn-accent-active hover:underline"
        onClick={onClearAll}
      >
        {t('activeFilterChips.limparFiltros')}
      </button>
    </div>
  );
}
