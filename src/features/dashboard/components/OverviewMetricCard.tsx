import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import type { OverviewMetric } from '../utils/buildOverviewMetrics';

const METRIC_ICONS: Record<string, string> = {
  documents: 'description',
  analysis: 'progress_activity',
  review: 'schedule',
  processed: 'check_circle',
  errors: 'error',
  events: 'monitoring',
};

const TONE_VALUE_CLASS = {
  default: 'text-doqyn-text',
  attention: 'text-amber-600/90 dark:text-amber-400/90',
  danger: 'text-doqyn-danger',
} as const;

const TONE_DOT_CLASS = {
  default: 'bg-doqyn-subtle/50',
  attention: 'bg-amber-500/70 dark:bg-amber-400/70',
  danger: 'bg-doqyn-danger/80',
} as const;

type OverviewMetricCardProps = {
  metric: OverviewMetric;
  onNavigate: (path: string) => void;
};

/** Célula de KPI na faixa executiva — leve, legível, clicável. */
export function OverviewMetricCard({ metric, onNavigate }: OverviewMetricCardProps) {
  const tone = metric.tone ?? 'default';
  const iconName = METRIC_ICONS[metric.key] ?? 'description';

  return (
    <button
      type="button"
      className={cn(
        'overview-metric-cell group flex h-full min-h-[7.5rem] flex-col justify-between gap-2 p-4 text-left sm:gap-2.5 sm:p-5',
        'transition-[background-color,transform] duration-[var(--transition-duration)] ease-[var(--ease-standard)]',
        'hover:bg-doqyn-surface-hover/45 active:scale-[0.995]',
        'focus-visible:ring-doqyn-accent-active/15 focus-visible:outline-none focus-visible:ring-1',
      )}
      onClick={() => onNavigate(metric.path)}
      aria-label={`${metric.label}: ${metric.value}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="overview-kpi-label">{metric.label}</span>
        <span className="flex items-center gap-1.5">
          {tone !== 'default' && (
            <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT_CLASS[tone])} aria-hidden />
          )}
          <Icon
            name={iconName}
            size={14}
            className="text-doqyn-subtle transition-colors duration-[var(--transition-duration)] group-hover:text-doqyn-muted"
            aria-hidden
          />
        </span>
      </div>

      <span className={cn('overview-kpi-value tabular-nums', TONE_VALUE_CLASS[tone])}>
        {metric.value}
      </span>

      <span className="overview-kpi-subtext line-clamp-2 min-h-[2.5rem]">{metric.subtext}</span>
    </button>
  );
}
