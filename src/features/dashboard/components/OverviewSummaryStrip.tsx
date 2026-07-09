import type { OverviewMetric } from '../utils/buildOverviewMetrics';
import { OverviewMetricCard } from './OverviewMetricCard';

type OverviewSummaryStripProps = {
  metrics: OverviewMetric[];
  onNavigate: (path: string) => void;
};

/** Faixa executiva de KPIs — superfície única com divisores discretos. */
export function OverviewSummaryStrip({ metrics, onNavigate }: OverviewSummaryStripProps) {
  return (
    <section
      className="overview-summary-strip overview-panel overflow-hidden"
      aria-label="Resumo executivo"
      data-testid="overview-summary-strip"
    >
      <div className="grid grid-cols-2 gap-px bg-doqyn-border-subtle/50 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.key} className="bg-doqyn-surface/40">
            <OverviewMetricCard metric={metric} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
    </section>
  );
}
