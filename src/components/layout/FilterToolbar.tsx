import type { ReactNode } from 'react';
export { FilterBar, FilterBarField, type FilterBarProps, type FilterBarFieldProps } from '@/components/ui/FilterBar';

/** @deprecated Use FilterBar from @/components/ui/FilterBar */
export function FilterToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        'rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-3'
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}
