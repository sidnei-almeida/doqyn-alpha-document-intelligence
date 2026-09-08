import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import { STATUS_FILTER_OPTIONS, resolveFilterOptions } from '../utils/libraryFilterOptions';
import { useTranslation } from 'react-i18next';

type FilterMenuProps = {
  status: string;
  onStatusChange: (status: string) => void;
};

/** Filtro discreto de status — mapeado para campos reais do backend. */
export function FilterMenu({ status, onStatusChange }: FilterMenuProps) {
  const { t } = useTranslation('library');

  return (
    <ToolbarSelect
      icon="filter_list"
      label={t('filterMenu.filtrarPorStatus')}
      value={status}
      defaultValue=""
      options={resolveFilterOptions(STATUS_FILTER_OPTIONS, t)}
      onChange={onStatusChange}
    />
  );
}
