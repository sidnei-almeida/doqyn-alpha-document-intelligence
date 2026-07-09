import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export type FilterBarProps = {
  children: ReactNode;
  className?: string;
  onClear?: () => void;
  showClear?: boolean;
  summary?: ReactNode;
};

export function FilterBar({
  children,
  className,
  onClear,
  showClear = false,
  summary,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'shrink-0 rounded-lg border border-doqyn-border bg-doqyn-surface',
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
      {(summary || (showClear && onClear)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-doqyn-border-subtle px-4 py-2.5">
          <div className="caption-text">{summary}</div>
          {showClear && onClear && (
            <Button type="button" variant="secondary" size="sm" onClick={onClear}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export type FilterBarFieldProps = {
  children: ReactNode;
  className?: string;
  /** Ocupa 2 colunas no grid responsivo. */
  span?: 1 | 2;
};

export function FilterBarField({ children, className, span = 1 }: FilterBarFieldProps) {
  return (
    <div className={cn(span === 2 && 'sm:col-span-2', className)}>{children}</div>
  );
}
