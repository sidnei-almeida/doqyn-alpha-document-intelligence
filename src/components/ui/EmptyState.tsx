import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-doqyn-border bg-doqyn-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-doqyn-card text-doqyn-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-doqyn-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-doqyn-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
