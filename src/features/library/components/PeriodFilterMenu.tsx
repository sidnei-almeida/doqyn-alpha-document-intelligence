import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryPeriodKey } from '../types/library';
import { PERIOD_FILTER_OPTIONS } from '../utils/libraryFilterOptions';

type PeriodFilterMenuProps = {
  value: LibraryPeriodKey;
  onChange: (period: LibraryPeriodKey) => void;
};

export function PeriodFilterMenu({ value, onChange }: PeriodFilterMenuProps) {
  return (
    <ToolbarSelect
      icon="calendar_month"
      label="Filtrar por data de modificação"
      value={value}
      defaultValue=""
      options={PERIOD_FILTER_OPTIONS}
      onChange={(next) => onChange(next as LibraryPeriodKey)}
    />
  );
}
