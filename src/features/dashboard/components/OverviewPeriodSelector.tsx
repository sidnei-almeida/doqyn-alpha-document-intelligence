import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

/**
 * Período — controle horizontal, então o escolhido marca com régua embaixo.
 * A cápsula preenchida saiu: preenchimento em acento é da ação principal.
 */
export function OverviewPeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriodKey;
  onChange: (period: DashboardPeriodKey) => void;
}) {
  return (
    <div
      className="flex h-9 items-stretch gap-1"
      role="group"
      aria-label="Período do painel"
      data-testid="overview-period-selector"
    >
      {PERIOD_OPTIONS.map((option) => {
        const isActive = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={isActive}
            className={cn(
              'relative rounded-[4px] px-2.5 text-caption font-medium transition-colors duration-150',
              'after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:transition-colors after:duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30',
              isActive
                ? 'text-doqyn-text after:bg-doqyn-accent-active'
                : 'text-doqyn-muted after:bg-transparent hover:text-doqyn-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
