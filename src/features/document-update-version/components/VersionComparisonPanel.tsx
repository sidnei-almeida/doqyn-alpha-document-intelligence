import { cn } from '@/lib/utils';
import type { VersionComparisonRow } from '../types';

type VersionComparisonPanelProps = {
  rows: VersionComparisonRow[];
  currentVersionLabel: string;
  nextVersionLabel: string;
};

export function VersionComparisonPanel({
  rows,
  currentVersionLabel,
  nextVersionLabel,
}: VersionComparisonPanelProps) {
  return (
    <section
      className="rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/50 p-3"
      data-testid="update-version-comparison-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-doqyn-muted">
          Comparar versões
        </p>
        <p className="shrink-0 text-[10px] text-doqyn-muted">
          {currentVersionLabel} →{' '}
          <span className="font-medium text-doqyn-primary">{nextVersionLabel}</span>
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              'rounded-lg border border-doqyn-border-subtle/70 px-2.5 py-2',
              row.changed && 'border-doqyn-warning/30 bg-doqyn-warning/5',
            )}
            data-changed={row.changed ? 'true' : 'false'}
          >
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-doqyn-text">{row.label}</p>
              {row.changed && (
                <span className="text-[9px] uppercase tracking-wide text-doqyn-warning">alterado</span>
              )}
            </div>
            <div className="mt-1.5 grid gap-1.5 text-[11px]">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-12 shrink-0 text-doqyn-muted">Atual</span>
                <span className="min-w-0 break-all text-doqyn-muted">{row.currentValue}</span>
              </div>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-12 shrink-0 text-doqyn-muted">Nova</span>
                <span className="min-w-0 break-all text-doqyn-text">{row.newValue}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
