import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeGroupProps = {
  children: ReactNode;
  className?: string;
  /** Alinhamento horizontal do grupo de badges. */
  align?: 'start' | 'center' | 'end';
};

/** Agrupa badges em linha com espaçamento e alinhamento consistentes. */
export function BadgeGroup({ children, className, align = 'start' }: BadgeGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1',
        align === 'center' && 'justify-center',
        align === 'end' && 'justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}
