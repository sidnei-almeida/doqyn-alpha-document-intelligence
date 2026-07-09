import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { OverviewLinkAction } from './OverviewLinkAction';

type OverviewPanelShellProps = {
  title: string;
  subtitle?: string;
  titleId?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'muted';
  className?: string;
  bodyClassName?: string;
  'data-testid'?: string;
};

/** Shell compartilhado dos painéis — header, superfície e ritmo consistentes. */
export function OverviewPanelShell({
  title,
  subtitle,
  titleId,
  actionLabel,
  onAction,
  action,
  children,
  variant = 'secondary',
  className,
  bodyClassName,
  'data-testid': testId,
}: OverviewPanelShellProps) {
  const headerAction =
    action ??
    (actionLabel && onAction ? (
      <OverviewLinkAction onClick={onAction}>{actionLabel}</OverviewLinkAction>
    ) : null);

  return (
    <section
      className={cn(
        'overview-panel flex h-full flex-col',
        variant === 'primary' && 'overview-panel--primary',
        variant === 'muted' && 'overview-panel--muted',
        className,
      )}
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <header className="overview-panel-header flex items-start justify-between gap-3 px-4 py-4 sm:px-5 sm:py-[1.125rem]">
        <div className="min-w-0">
          <h2 id={titleId} className="overview-section-title">
            {title}
          </h2>
          {subtitle && <p className="overview-section-subtitle mt-0.5">{subtitle}</p>}
        </div>
        {headerAction}
      </header>
      <div className={cn('overview-panel-body flex min-h-0 flex-1 flex-col', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
