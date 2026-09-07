import type { OverviewMetric } from '../utils/buildOverviewMetrics';
import { OverviewMetricCard } from './OverviewMetricCard';

type OverviewSummaryStripProps = {
  metrics: OverviewMetric[];
  onNavigate: (path: string) => void;
};

/**
 * Os números do período abrem a página como o cabeçalho de um boletim: uma
 * régua entre dois fios, colunas separadas por fio — sem cartão em volta.
 */
export function OverviewSummaryStrip({ metrics, onNavigate }: OverviewSummaryStripProps) {
  return (
    <section
      className="overview-summary-strip overview-panel"
      aria-label="Resumo do período"
      data-testid="overview-summary-strip"
    >
      <div className="overview-stat-grid grid-cols-2 border-b border-doqyn-border-subtle/75 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.key} className="overview-stat-cell">
            <OverviewMetricCard metric={metric} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
    </section>
  );
}
