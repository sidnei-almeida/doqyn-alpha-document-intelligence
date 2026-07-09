import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (item: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sparseMessage?: string;
  sparseDescription?: string;
  sparseAction?: ReactNode;
  minRowsForSparse?: number;
  footer?: ReactNode;
  className?: string;
  stretch?: boolean;
};

const TABLE_HEAD_CLASS =
  'type-label px-4 py-3 text-left uppercase tracking-wide text-doqyn-muted';

const TABLE_CELL_CLASS = 'type-body px-4 py-3.5 align-middle';

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKey,
  emptyMessage = 'Nenhum registro encontrado',
  emptyDescription,
  emptyAction,
  sparseMessage,
  sparseDescription,
  sparseAction,
  minRowsForSparse = 5,
  footer,
  className,
  stretch = false,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description={emptyDescription}
        action={emptyAction}
        stretch={stretch}
        className={cn(stretch && 'min-h-[420px]', className)}
      />
    );
  }

  const showSparseFooter =
    Boolean(sparseMessage) && data.length > 0 && data.length < minRowsForSparse;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-doqyn-border bg-doqyn-surface',
        stretch && 'min-h-[420px] flex-1',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-doqyn-border bg-doqyn-card">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(TABLE_HEAD_CLASS, col.headerClassName, col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const key = keyExtractor(item);
              const isSelected = selectedKey === key;

              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'border-b border-doqyn-border-subtle transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-doqyn-surface-hover',
                    isSelected && 'bg-doqyn-primary-bg',
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn(TABLE_CELL_CLASS, col.className)}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showSparseFooter && (
        <div className="flex flex-1 flex-col items-center justify-center border-t border-doqyn-border-subtle px-6 py-10 text-center">
          <p className="text-sm font-medium text-doqyn-text">{sparseMessage}</p>
          {sparseDescription && (
            <p className="caption-text mt-1 max-w-md">{sparseDescription}</p>
          )}
          {sparseAction && <div className="mt-4">{sparseAction}</div>}
        </div>
      )}

      {footer && (
        <div className="shrink-0 border-t border-doqyn-border-subtle px-4 py-3">{footer}</div>
      )}
    </div>
  );
}
