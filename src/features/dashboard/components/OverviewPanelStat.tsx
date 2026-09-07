import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OverviewPanelStatProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  onClick?: () => void;
  valueClassName?: string;
};

export function OverviewPanelStat({
  label,
  value,
  hint,
  onClick,
  valueClassName,
}: OverviewPanelStatProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="overview-stat flex h-full min-h-[5.5rem] w-full flex-col justify-center px-4 py-4 text-left"
    >
      <p className="overview-kpi-label">{label}</p>
      <div className={cn('overview-governance-value mt-1.5 tabular-nums', valueClassName)}>
        {value}
      </div>
      {hint ? <p className="overview-kpi-subtext mt-1 line-clamp-2">{hint}</p> : null}
    </Wrapper>
  );
}

type OverviewPanelStatGridProps = {
  children: ReactNode;
  columnsClassName?: string;
};

export function OverviewPanelStatGrid({
  children,
  columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}: OverviewPanelStatGridProps) {
  return <div className={cn('overview-stat-grid', columnsClassName)}>{children}</div>;
}

export function OverviewPanelStatCell({ children }: { children: ReactNode }) {
  return <div className="overview-stat-cell">{children}</div>;
}
