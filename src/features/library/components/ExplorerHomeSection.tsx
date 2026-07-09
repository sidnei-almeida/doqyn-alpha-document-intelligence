import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ExplorerHomeSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
};

/** Seção da home da Biblioteca — título discreto e conteúdo arejado. */
export function ExplorerHomeSection({
  title,
  description,
  action,
  children,
  className,
  'data-testid': testId,
}: ExplorerHomeSectionProps) {
  return (
    <section className={cn('explorer-home-section', className)} data-testid={testId}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-doqyn-text">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[12px] text-doqyn-subtle">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
