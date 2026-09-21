import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryTypeFilter } from '../types/library';
import { TYPE_FILTER_OPTIONS, resolveFilterOptions } from '../utils/libraryFilterOptions';
import { useTranslation } from 'react-i18next';

type TypeFilterMenuProps = {
  value: LibraryTypeFilter;
  onChange: (type: LibraryTypeFilter) => void;
};

export function TypeFilterMenu({ value, onChange }: TypeFilterMenuProps) {
  const { t } = useTranslation('library');

  return (
    <ToolbarSelect
      icon="draft"
      label={t('typeFilterMenu.filtrarPorTipo')}
      value={value}
      defaultValue=""
      options={resolveFilterOptions(TYPE_FILTER_OPTIONS, t)}
      onChange={(next) => onChange(next as LibraryTypeFilter)}
    />
  );
}
