import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OverviewEmptyHintProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Empty state leve — sem hero, ícone grande ou card pesado. */
export function OverviewEmptyHint({ title, description, action, className }: OverviewEmptyHintProps) {
  return (
    <div
      className={cn(
        'overview-empty-hint flex min-h-[10rem] flex-1 flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
      role="status"
    >
      <p className="text-base font-medium text-doqyn-text">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-doqyn-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
