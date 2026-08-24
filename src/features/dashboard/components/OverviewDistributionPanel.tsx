import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';

type OverviewDistributionPanelProps = {
  title: string;
  subtitle?: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
};

/** Distribuição — fio de 3px com ponta reta, contagem em mono tabular. */
export function OverviewDistributionPanel({
  title,
  subtitle,
  items,
  emptyLabel,
}: OverviewDistributionPanelProps) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <OverviewPanelShell
      title={title}
      subtitle={subtitle}
      bodyClassName="flex-1 pt-4"
    >
      {items.length === 0 ? (
        <OverviewEmptyHint title={emptyLabel} className="min-h-[8rem] px-0 py-6" />
      ) : (
        <div className="max-h-[14rem] flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <TruncatedText className="text-label text-doqyn-text">{item.label}</TruncatedText>
                <span className="shrink-0 font-mono text-caption tabular-nums text-doqyn-muted">
                  {item.count}
                  <span className="text-doqyn-subtle">
                    {total > 0 ? ` · ${Math.round((item.count / total) * 100)}%` : ''}
                  </span>
                </span>
              </div>
              <div
                className="overview-meter"
                role="meter"
                aria-valuenow={item.count}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${item.label}: ${item.count}`}
              >
                <div
                  className="overview-meter-fill"
                  style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </OverviewPanelShell>
  );
}
