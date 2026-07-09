import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryTypeFilter } from '../types/library';
import { TYPE_FILTER_OPTIONS } from '../utils/libraryFilterOptions';

type TypeFilterMenuProps = {
  value: LibraryTypeFilter;
  onChange: (type: LibraryTypeFilter) => void;
};

export function TypeFilterMenu({ value, onChange }: TypeFilterMenuProps) {
  return (
    <ToolbarSelect
      icon="draft"
      label="Filtrar por tipo"
      value={value}
      defaultValue=""
      options={TYPE_FILTER_OPTIONS}
      onChange={(next) => onChange(next as LibraryTypeFilter)}
    />
  );
}
