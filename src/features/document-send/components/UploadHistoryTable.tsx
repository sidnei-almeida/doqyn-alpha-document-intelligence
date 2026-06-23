import { MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { DocumentHistoryItem } from '../types';
import { ConfidenceBadge } from './ConfidenceBadge';
import { StatusBadge } from './StatusBadge';

const TABLE_GRID =
  'grid-cols-[minmax(140px,1.2fr)_minmax(160px,1.4fr)_minmax(110px,0.9fr)_140px_100px_72px_130px_130px_44px]';

interface UploadHistoryTableProps {
  items: DocumentHistoryItem[];
  className?: string;
}

export function UploadHistoryTable({ items, className }: UploadHistoryTableProps) {
  return (
    <Card className={cn('w-full border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader>
        <CardTitle>Histórico de envios</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="w-full min-w-[1100px]" role="table" aria-label="Histórico de envios">
            <div
              role="row"
              className={cn(
                'grid w-full items-center border-b border-doqyn-border px-4 pb-2.5',
                TABLE_GRID,
              )}
            >
              <div role="columnheader" className="pr-3 text-xs font-medium text-doqyn-muted">
                Documento original
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Nome sugerido
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Categoria
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Status
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Confiança
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Versão
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Enviado em
              </div>
              <div role="columnheader" className="px-3 text-xs font-medium text-doqyn-muted">
                Última ação
              </div>
              <div role="columnheader" className="pl-3">
                <span className="sr-only">Ações</span>
              </div>
            </div>

            {items.map((item, index) => (
              <div
                key={item.id}
                role="row"
                className={cn(
                  'grid w-full items-center px-4 py-3.5 transition-colors hover:bg-doqyn-hover',
                  index < items.length - 1 && 'border-b border-doqyn-border-subtle',
                  TABLE_GRID,
                )}
              >
                <div
                  role="cell"
                  className="min-w-0 truncate pr-3 text-sm font-medium text-doqyn-text"
                  title={item.originalName}
                >
                  {item.originalName}
                </div>
                <div
                  role="cell"
                  className="min-w-0 truncate px-3 font-mono text-xs text-doqyn-muted"
                  title={item.suggestedName}
                >
                  {item.suggestedName}
                </div>
                <div role="cell" className="px-3 text-sm text-doqyn-muted">
                  {item.category}
                </div>
                <div role="cell" className="min-w-0 overflow-hidden px-3">
                  <StatusBadge status={item.status} className="max-w-full" />
                </div>
                <div role="cell" className="px-3">
                  <ConfidenceBadge score={item.confidenceScore} />
                </div>
                <div role="cell" className="px-3 font-mono text-xs text-doqyn-muted">
                  {item.version}
                </div>
                <div role="cell" className="px-3 text-xs text-doqyn-muted">
                  {item.uploadedAt}
                </div>
                <div role="cell" className="px-3 text-xs text-doqyn-muted">
                  {item.lastActionAt}
                </div>
                <div role="cell" className="flex justify-center pl-3">
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong"
                    aria-label={`Ações para ${item.originalName}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
