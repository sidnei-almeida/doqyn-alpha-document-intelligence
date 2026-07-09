import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SidebarSectionProps = {
  label?: string;
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
};

/** Agrupa itens da sidebar com rótulo discreto. */
export function SidebarSection({ label, children, className, collapsed = false }: SidebarSectionProps) {
  return (
    <div className={cn('px-1', className)}>
      {label && !collapsed && (
        <p className="type-eyebrow mb-1.5 px-3 text-doqyn-subtle">
          {label}
        </p>
      )}
      <div className={cn('flex flex-col', collapsed ? 'gap-0' : 'gap-0.5')}>{children}</div>
    </div>
  );
}
