import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { LibraryRouteState } from '../types/library';
import {
  OWNER_FILTER_OPTIONS,
  PERIOD_FILTER_OPTIONS,
  SORT_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  encodeSortOptionValue,
} from '../utils/libraryFilterOptions';

type ExplorerFilterChipsProps = {
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
};

type FilterChipProps = {
  icon: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  defaultValue?: string;
};

function FilterChip({ icon, label, value, options, onChange, defaultValue = '' }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isActive = value !== defaultValue;
  const displayLabel = options.find((option) => option.value === value)?.label ?? label;

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          isActive ? 'explorer-filter-chip explorer-filter-chip--active' : 'explorer-filter-chip'
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
      >
        <Icon name={icon} size={ICON_SIZE.sm} className="shrink-0" />
        <span className="max-w-[11rem] truncate">{displayLabel}</span>
        <Icon
          name="keyboard_arrow_down"
          size={ICON_SIZE.xs}
          className={cn('shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        role="listbox"
        aria-label={label}
        className="min-w-[10rem] max-w-[min(18rem,calc(100vw-1rem))] py-1"
        panelStyle={
          anchorRef.current
            ? { minWidth: anchorRef.current.getBoundingClientRect().width }
            : undefined
        }
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </AnchoredPopover>
    </div>
  );
}

/** Chips de filtro minimalistas na home da Biblioteca. */
export function ExplorerFilterChips({ state, onStateChange }: ExplorerFilterChipsProps) {
  const sortValue = encodeSortOptionValue(state.sort, state.direction);

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="explorer-filter-chips"
      role="group"
      aria-label="Filtros da biblioteca"
    >
      <FilterChip
        icon="filter_list"
        label="Filtrar por status"
        value={state.status}
        defaultValue=""
        options={STATUS_FILTER_OPTIONS}
        onChange={(status) => onStateChange({ status })}
      />
      <FilterChip
        icon="draft"
        label="Filtrar por tipo"
        value={state.type}
        defaultValue=""
        options={TYPE_FILTER_OPTIONS}
        onChange={(type) => onStateChange({ type: type as LibraryRouteState['type'] })}
      />
      <FilterChip
        icon="calendar_month"
        label="Filtrar por período"
        value={state.period}
        defaultValue=""
        options={PERIOD_FILTER_OPTIONS}
        onChange={(period) => onStateChange({ period: period as LibraryRouteState['period'] })}
      />
      <FilterChip
        icon="person"
        label="Filtrar por proprietário"
        value={state.owner}
        defaultValue=""
        options={OWNER_FILTER_OPTIONS}
        onChange={(owner) => onStateChange({ owner: owner as LibraryRouteState['owner'] })}
      />
      <FilterChip
        icon="swap_vert"
        label="Ordenar por"
        value={sortValue}
        defaultValue={encodeSortOptionValue('updatedAt', 'desc')}
        options={SORT_FILTER_OPTIONS.map((option) => ({
          value: encodeSortOptionValue(option.sort, option.direction),
          label: option.label,
        }))}
        onChange={(next) => {
          const match = SORT_FILTER_OPTIONS.find(
            (option) => encodeSortOptionValue(option.sort, option.direction) === next,
          );
          if (match) onStateChange({ sort: match.sort, direction: match.direction });
        }}
      />
    </div>
  );
}
