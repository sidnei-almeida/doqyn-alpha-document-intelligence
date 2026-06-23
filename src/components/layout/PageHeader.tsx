import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 border-b border-doqyn-border pb-4', className)}>
      {eyebrow && <p className="eyebrow-text mb-1">{eyebrow}</p>}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>}
      </div>
    </header>
  );
}
