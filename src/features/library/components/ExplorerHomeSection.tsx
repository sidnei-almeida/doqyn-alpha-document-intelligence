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

/** Seção da home da Biblioteca — rótulo em monoespaçado sobre fio. */
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
      {/* Eyebrow em monoespaçado sobre fio, no lugar do título em 13px solto:
          é o mesmo rótulo de seção que os formulários da antessala usam, e o
          fio dá ao bloco um começo visível sem precisar de caixa. */}
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-doqyn-border-subtle pb-2.5">
        <div className="min-w-0">
          <h2 className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
            {title}
          </h2>
          {description && <p className="mt-1 text-caption text-doqyn-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
