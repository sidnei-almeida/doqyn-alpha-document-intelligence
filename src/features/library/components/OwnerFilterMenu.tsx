import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryOwnerFilter } from '../types/library';
import { OWNER_FILTER_OPTIONS } from '../utils/libraryFilterOptions';
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
      options={OWNER_FILTER_OPTIONS}
      onChange={(next) => onChange(next as LibraryOwnerFilter)}
    />
  );
}
