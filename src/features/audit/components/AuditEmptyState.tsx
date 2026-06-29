import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AuditEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
};

export function AuditEmptyState({ icon, title, description, className }: AuditEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-doqyn-border bg-doqyn-surface px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-doqyn-card text-doqyn-muted">
        {icon}
      </div>
      <p className="text-sm font-medium text-doqyn-text">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-doqyn-muted">{description}</p>
    </div>
  );
}
