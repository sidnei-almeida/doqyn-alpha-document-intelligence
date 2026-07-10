import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
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
      className="overview-governance-stat flex h-full min-h-[5.75rem] flex-col justify-center px-3 py-3 text-left sm:px-4 sm:py-4"
    >
      <p className="overview-kpi-label">{label}</p>
      <div className={cn('overview-governance-value mt-1 tabular-nums', valueClassName)}>{value}</div>
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
  return (
    <div className={cn('grid gap-px bg-doqyn-border-subtle/50', columnsClassName)}>
      {children}
    </div>
  );
}

export function OverviewPanelStatCell({ children }: { children: ReactNode }) {
  return <div className="bg-doqyn-surface/35">{children}</div>;
}

type OverviewPanelFooterLink = {
  label: string;
  path: string;
};

type OverviewPanelFooterProps = {
  links: OverviewPanelFooterLink[];
  onNavigate: (path: string) => void;
  status?: ReactNode;
};

export function OverviewPanelFooter({ links, onNavigate, status }: OverviewPanelFooterProps) {
  return (
    <div className="border-t border-doqyn-border-subtle/60 px-4 py-3 sm:px-5">
      {status ? <div className="mb-2.5 min-h-[1.25rem] text-sm leading-relaxed">{status}</div> : null}
      <div className="flex flex-wrap gap-2">
        {links.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => onNavigate(item.path)}
            className="inline-flex items-center gap-1 rounded-full border border-doqyn-border-subtle bg-doqyn-bg/50 px-3 py-1.5 text-xs font-medium text-doqyn-text hover:bg-doqyn-surface-hover"
          >
            {item.label}
            <Icon name="chevron_right" size={14} className="text-doqyn-subtle" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
