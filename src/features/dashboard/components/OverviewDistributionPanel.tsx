import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';

type OverviewDistributionPanelProps = {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
};

/** Barras horizontais discretas para distribuição por status ou categoria. */
export function OverviewDistributionPanel({
  title,
  items,
  emptyLabel,
}: OverviewDistributionPanelProps) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <OverviewPanelShell
      title={title}
      className="h-full min-h-[16rem]"
      bodyClassName="flex min-h-0 flex-1 flex-col px-0 pb-0 pt-0"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
        {items.length === 0 ? (
          <OverviewEmptyHint title={emptyLabel} className="min-h-[10rem] flex-1 px-0 py-6" />
        ) : (
          <div className="overview-distribution-list max-h-[14rem] flex-1 space-y-3.5 overflow-y-auto pr-1 scrollbar-thin">
            {items.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <TruncatedText className="text-sm text-doqyn-text">{item.label}</TruncatedText>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-doqyn-muted">
                    {item.count}
                  </span>
                </div>
                <div
                  className="overview-distribution-track"
                  role="meter"
                  aria-valuenow={item.count}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-label={`${item.label}: ${item.count}`}
                >
                  <div
                    className="overview-distribution-fill"
                    style={{ width: `${Math.max(5, (item.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OverviewPanelShell>
  );
}
