import { ToolbarSelect } from '@/components/ui/ToolbarSelect';
import type { LibraryPeriodKey } from '../types/library';
import { PERIOD_FILTER_OPTIONS, resolveFilterOptions } from '../utils/libraryFilterOptions';
import { useTranslation } from 'react-i18next';

type PeriodFilterMenuProps = {
  value: LibraryPeriodKey;
  onChange: (period: LibraryPeriodKey) => void;
};

export function PeriodFilterMenu({ value, onChange }: PeriodFilterMenuProps) {
  const { t } = useTranslation('library');

  return (
    <ToolbarSelect
      icon="calendar_month"
      label={t('periodFilterMenu.filtrarPorDataDe')}
      value={value}
      defaultValue=""
      options={resolveFilterOptions(PERIOD_FILTER_OPTIONS, t)}
      onChange={(next) => onChange(next as LibraryPeriodKey)}
    />
  );
}
