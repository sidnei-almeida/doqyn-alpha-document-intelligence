import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  emptyMessage?: string;
  className?: string;
  stretch?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKey,
  emptyMessage = 'Nenhum registro encontrado',
  className,
  stretch = false,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-10 text-center text-sm text-doqyn-muted',
          stretch && 'flex min-h-[420px] flex-1 items-center justify-center',
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-doqyn-border',
        stretch && 'flex min-h-[420px] flex-1 flex-col',
        className,
      )}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-doqyn-border bg-doqyn-card">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-muted',
                  col.className,
                )}
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
                  'border-b border-doqyn-border-subtle last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-doqyn-hover',
                  isSelected && 'bg-doqyn-primary-bg',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-doqyn-text', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
