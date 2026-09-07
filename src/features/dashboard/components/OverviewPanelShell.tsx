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
  className?: string;
  bodyClassName?: string;
  'data-testid'?: string;
};

/**
 * Abertura de bloco — fio em cima, rótulo de registro, fio abaixo do cabeçalho.
 * Não há caixa: o que separa um bloco do outro é a linha e o espaço.
 */
export function OverviewPanelShell({
  title,
  subtitle,
  titleId,
  actionLabel,
  onAction,
  action,
  children,
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
      className={cn('overview-panel flex flex-col', className)}
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <header className="overview-panel-header flex items-baseline justify-between gap-4 py-3.5">
        <div className="min-w-0">
          <h2 id={titleId} className="overview-section-title">
            {title}
          </h2>
          {subtitle && <p className="overview-section-subtitle mt-1">{subtitle}</p>}
        </div>
        {headerAction}
      </header>
      <div className={cn('overview-panel-body flex min-h-0 flex-1 flex-col', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
