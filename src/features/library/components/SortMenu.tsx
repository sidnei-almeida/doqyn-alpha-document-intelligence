import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibrarySortDirection, LibrarySortKey } from '../types/library';
import {
  SORT_FILTER_OPTIONS,
  decodeSortOptionValue,
  encodeSortOptionValue,
} from '../utils/libraryFilterOptions';

type SortMenuProps = {
  sort: LibrarySortKey;
  direction: LibrarySortDirection;
  onChange: (patch: { sort: LibrarySortKey; direction: LibrarySortDirection }) => void;
};

export function SortMenu({ sort, direction, onChange }: SortMenuProps) {
  const value = encodeSortOptionValue(sort, direction);

  return (
    <ToolbarSelect
      icon="swap_vert"
      label="Ordenar por"
      value={value}
      defaultValue={encodeSortOptionValue('updatedAt', 'desc')}
      options={SORT_FILTER_OPTIONS.map((option) => ({
        value: encodeSortOptionValue(option.sort, option.direction),
        label: option.label,
      }))}
      onChange={(next) => {
        const resolved = decodeSortOptionValue(next);
        if (resolved) onChange({ sort: resolved.sort, direction: resolved.direction });
      }}
    />
  );
}
