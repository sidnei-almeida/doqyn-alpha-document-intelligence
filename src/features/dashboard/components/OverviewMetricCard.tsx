import { cn } from '@/lib/utils';
import type { OverviewMetric } from '../utils/buildOverviewMetrics';

const TONE_VALUE_CLASS = {
  default: 'text-doqyn-text',
  attention: 'text-doqyn-warning',
  danger: 'text-doqyn-danger',
} as const;

type OverviewMetricCardProps = {
  metric: OverviewMetric;
  onNavigate: (path: string) => void;
};

/**
 * Célula da faixa de números. O ícone saiu: seis ícones decorativos em fila
 * competiam com os seis números, que são o conteúdo. O tom fica no algarismo.
 */
export function OverviewMetricCard({ metric, onNavigate }: OverviewMetricCardProps) {
  const tone = metric.tone ?? 'default';

  return (
    <button
      type="button"
      className="overview-metric-cell group flex h-full w-full flex-col justify-between gap-3 px-4 py-4 text-left"
      onClick={() => onNavigate(metric.path)}
      aria-label={`${metric.label}: ${metric.value}`}
    >
      <span className="overview-kpi-label">{metric.label}</span>
      <span className={cn('overview-kpi-value tabular-nums', TONE_VALUE_CLASS[tone])}>
        {metric.value}
      </span>
      <span className="overview-kpi-subtext line-clamp-2 min-h-[2.25rem]">{metric.subtext}</span>
    </button>
  );
}
