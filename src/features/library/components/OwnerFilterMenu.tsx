import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryOwnerFilter } from '../types/library';
import { OWNER_FILTER_OPTIONS } from '../utils/libraryFilterOptions';

type OwnerFilterMenuProps = {
  value: LibraryOwnerFilter;
  onChange: (owner: LibraryOwnerFilter) => void;
};

export function OwnerFilterMenu({ value, onChange }: OwnerFilterMenuProps) {
  return (
    <ToolbarSelect
      icon="person"
      label="Filtrar por proprietário"
      value={value}
      defaultValue=""
      options={OWNER_FILTER_OPTIONS}
      onChange={(next) => onChange(next as LibraryOwnerFilter)}
    />
  );
}
