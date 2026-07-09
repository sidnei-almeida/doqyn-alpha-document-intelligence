import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

type OverviewPeriodSelectorProps = {
  value: DashboardPeriodKey;
  onChange: (period: DashboardPeriodKey) => void;
};

/** Seletor de período — pill discreto, alinhado ao workspace. */
export function OverviewPeriodSelector({ value, onChange }: OverviewPeriodSelectorProps) {
  return (
    <div
      className="flex h-9 items-center rounded-full bg-doqyn-card/60 p-0.5"
      role="group"
      aria-label="Período do painel"
      data-testid="overview-period-selector"
    >
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={cn(
            'h-full rounded-full px-3 text-xs font-medium transition-[color,background-color,box-shadow] duration-150',
            value === option.key
              ? 'bg-doqyn-selected text-doqyn-text shadow-sm'
              : 'text-doqyn-muted hover:text-doqyn-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
