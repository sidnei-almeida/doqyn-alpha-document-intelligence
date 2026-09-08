import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import { SegmentedTextToggle } from '@/components/ui/SegmentedTextToggle';
import { useTranslation } from 'react-i18next';

const PERIOD_OPTIONS: Array<{ value: DashboardPeriodKey; label: string }> = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

/** Período do painel — a régua marca o escolhido, sem cápsula. */
export function OverviewPeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriodKey;
  onChange: (period: DashboardPeriodKey) => void;
}) {
  const { t } = useTranslation('dashboard');

  return (
    <SegmentedTextToggle
      value={value}
      options={PERIOD_OPTIONS}
      onChange={onChange}
      aria-label={t('overviewPeriodSelector.periodoDoPainel')}
      className="[&>button]:text-caption"
    />
  );
}
