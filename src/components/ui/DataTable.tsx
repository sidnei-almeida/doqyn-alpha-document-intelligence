import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { useTranslation } from 'react-i18next';

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
  density?: 'comfortable' | 'compact';
  /**
   * Detalhe aberto embaixo da própria linha, ocupando a largura da tabela.
   * Um registro que se abre no lugar mantém o antes e o depois à vista; uma
   * gaveta lateral cobre a lista justamente quando se está comparando linhas.
   */
  renderExpanded?: (item: T) => ReactNode;
  expandedKey?: string | null;
};

/**
 * A tabela é registro, não card.
 *
 * Era uma caixa com borda, canto de 8px e cabeçalho preenchido — a moldura em
 * volta de uma lista que o espaço já separava. Agora abre com um fio, o
 * cabeçalho é rótulo de registro em monoespaçado e as linhas se separam por
 * fio, como as pastas da Biblioteca e a grade da Matriz.
 */
const DENSITY_STYLES = {
  comfortable: {
    head: 'register-label px-4 py-3 text-left text-doqyn-subtle',
    cell: 'type-label px-4 py-3.5 align-middle',
    footer: 'px-4 py-3',
    thead: 'border-b border-doqyn-border-subtle',
  },
  compact: {
    head: 'register-label px-3 py-2 text-left text-doqyn-subtle',
    cell: 'type-label px-3 py-2 align-middle leading-snug',
    footer: 'px-3 py-2',
    thead: 'border-b border-doqyn-border-subtle',
  },
} as const;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKey,
  emptyMessage,
  emptyDescription,
  emptyAction,
  sparseMessage,
  sparseDescription,
  sparseAction,
  minRowsForSparse = 5,
  footer,
  className,
  stretch = false,
  density = 'comfortable',
  renderExpanded,
  expandedKey = null,
}: DataTableProps<T>) {
  const { t } = useTranslation('components');
  const densityStyle = DENSITY_STYLES[density];
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage ?? t('dataTable.empty')}
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
        'flex flex-col border-t border-doqyn-border',
        stretch && 'min-h-[420px] flex-1',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={densityStyle.thead}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(densityStyle.head, col.headerClassName, col.className)}
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

              const isExpanded = Boolean(renderExpanded) && expandedKey === key;

              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => onRowClick?.(item)}
                    aria-expanded={renderExpanded ? isExpanded : undefined}
                    className={cn(
                      // A régua de acento vem de `box-shadow` interno, não de um
                      // `::before`: pseudo-elemento filho de <tr> vira célula
                      // anônima e empurra a linha inteira uma coluna para a
                      // direita — o nome aparecia debaixo do cabeçalho do e-mail.
                      'data-table-row border-b border-doqyn-border-subtle/75 transition-colors last:border-0',
                      (onRowClick || density === 'compact') && 'cursor-pointer',
                      (isSelected || isExpanded) && 'data-table-row--selected',
                      isExpanded && 'border-b-0',
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn(densityStyle.cell, col.className)}>
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="data-table-row--expanded border-b border-doqyn-border-subtle/75">
                      <td colSpan={columns.length} className="p-0">
                        {renderExpanded?.(item)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showSparseFooter && (
        <div className="flex flex-1 flex-col items-center justify-center border-t border-doqyn-border-subtle px-6 py-10 text-center">
          <p className="text-label font-medium text-doqyn-text">{sparseMessage}</p>
          {sparseDescription && <p className="caption-text mt-1 max-w-md">{sparseDescription}</p>}
          {sparseAction && <div className="mt-4">{sparseAction}</div>}
        </div>
      )}

      {footer && (
        <div className={cn('shrink-0 border-t border-doqyn-border-subtle', densityStyle.footer)}>
          {footer}
        </div>
      )}
    </div>
  );
}
