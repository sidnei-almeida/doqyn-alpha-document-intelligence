import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageHeader } from './PageHeader';

export type PageShellProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function PageShell({
  title,
  description,
  eyebrow,
  actions,
  className,
  bodyClassName,
  children,
}: PageShellProps) {
  return (
    <div className={cn('page-shell flex min-h-0 flex-1 flex-col', className)}>
      <div className="page-shell__header shrink-0">
        <PageHeader
          title={title}
          description={description}
          eyebrow={eyebrow}
          actions={actions}
        />
      </div>
      <div className={cn('page-shell__body flex min-h-0 flex-1 flex-col gap-6', bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
