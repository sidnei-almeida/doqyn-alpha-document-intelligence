import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

type OverviewEmptyHintProps = {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
  className?: string;
};

/** Aviso de bloco vazio — sem disco, sem moldura, ocupando o espaço direto. */
export function OverviewEmptyHint({
  title,
  description,
  icon,
  action,
  className,
}: OverviewEmptyHintProps) {
  return (
    <div
      className={cn(
        'flex min-h-[10rem] flex-1 flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
      role="status"
    >
      {icon && (
        <Icon
          name={icon}
          size={ICON_SIZE.md}
          className="mb-4 text-doqyn-border-strong"
          aria-hidden
        />
      )}
      <p className="text-label font-medium text-doqyn-text">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-[42ch] text-caption leading-relaxed text-doqyn-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
