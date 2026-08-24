import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  stretch?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  stretch = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl bg-doqyn-card/60 px-8 py-14 text-center',
        stretch && 'min-h-[360px] flex-1',
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="mb-4 flex items-center justify-center text-doqyn-border-strong">{icon}</div>
      ) : (
        <div className="mb-5 h-px w-10 bg-doqyn-border-subtle" aria-hidden />
      )}
      <p className="text-label font-medium text-doqyn-text">{title}</p>
      {description && (
        <p className="caption-text mt-1.5 max-w-[42ch] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
