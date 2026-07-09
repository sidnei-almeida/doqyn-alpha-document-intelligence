import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import { STATUS_FILTER_OPTIONS } from '../utils/libraryFilterOptions';

type FilterMenuProps = {
  status: string;
  onStatusChange: (status: string) => void;
};

/** Filtro discreto de status — mapeado para campos reais do backend. */
export function FilterMenu({ status, onStatusChange }: FilterMenuProps) {
  return (
    <ToolbarSelect
      icon="filter_list"
      label="Filtrar por status"
      value={status}
      defaultValue=""
      options={STATUS_FILTER_OPTIONS}
      onChange={onStatusChange}
    />
  );
}
