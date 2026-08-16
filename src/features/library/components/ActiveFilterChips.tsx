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
  resolveSortOptionLabel,
} from '../utils/libraryFilterOptions';

type ActiveFilterChipsProps = {
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
  onClearAll: () => void;
  folderName?: string;
  filterCapabilities?: LibraryCollectionFilterCapabilities;
};

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="explorer-filter-chip explorer-filter-chip--active inline-flex items-center gap-1 pr-1">
      <span className="max-w-[12rem] truncate">{label}</span>
      <button
        type="button"
        className="rounded-full p-0.5 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
        aria-label={`Remover filtro ${label}`}
        onClick={onRemove}
      >
        <Icon name="close" size={ICON_SIZE.xs} />
      </button>
    </span>
  );
}

function labelFor(
  options: Array<{ value: string; label: string }>,
  value: string,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

/** Chips removíveis para busca e filtros ativos. */
export function ActiveFilterChips({
  state,
  onStateChange,
  onClearAll,
  folderName,
  filterCapabilities,
}: ActiveFilterChipsProps) {
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
      label: `Busca: ${state.q.trim()}`,
      onRemove: () => onStateChange({ q: '' }),
    });
  }

  if (folderName && state.scope !== 'all') {
    chips.push({
      key: 'scope-folder',
      label: `Em: ${folderName}`,
      onRemove: () => onStateChange({ scope: 'all' }),
    });
  }

  if (caps.status && state.status) {
    chips.push({
      key: 'status',
      label: labelFor(STATUS_FILTER_OPTIONS, state.status, 'Status'),
      onRemove: () => onStateChange({ status: '' }),
    });
  }

  if (caps.type && state.type) {
    chips.push({
      key: 'type',
      label: labelFor(TYPE_FILTER_OPTIONS, state.type, 'Tipo'),
      onRemove: () => onStateChange({ type: '' }),
    });
  }

  if (caps.period && state.period) {
    chips.push({
      key: 'period',
      label: labelFor(PERIOD_FILTER_OPTIONS, state.period, 'Período'),
      onRemove: () => onStateChange({ period: '' }),
    });
  }

  if (caps.owner && state.owner) {
    chips.push({
      key: 'owner',
      label: labelFor(OWNER_FILTER_OPTIONS, state.owner, 'Proprietário'),
      onRemove: () => onStateChange({ owner: '' }),
    });
  }

  if (state.scope === 'all' && folderName) {
    chips.push({
      key: 'scope-all',
      label: 'Toda a biblioteca',
      onRemove: () => onStateChange({ scope: '' }),
    });
  }

  const sortLabel = resolveSortOptionLabel(state.sort, state.direction);
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
      aria-label="Filtros ativos"
    >
      {chips.map((chip) => (
        <RemovableChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
      ))}
      <button
        type="button"
        className="text-[12px] font-medium text-doqyn-accent-active hover:underline"
        onClick={onClearAll}
      >
        Limpar filtros
      </button>
    </div>
  );
}
