import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryOwnerFilter } from '../types/library';
import { OWNER_FILTER_OPTIONS, resolveFilterOptions } from '../utils/libraryFilterOptions';
import { useTranslation } from 'react-i18next';

type OwnerFilterMenuProps = {
  value: LibraryOwnerFilter;
  onChange: (owner: LibraryOwnerFilter) => void;
};

export function OwnerFilterMenu({ value, onChange }: OwnerFilterMenuProps) {
  const { t } = useTranslation('library');

  return (
    <ToolbarSelect
      icon="person"
      label={t('ownerFilterMenu.filtrarPorProprietario')}
      value={value}
      defaultValue=""
      options={resolveFilterOptions(OWNER_FILTER_OPTIONS, t)}
      onChange={(next) => onChange(next as LibraryOwnerFilter)}
    />
  );
}
