import { MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { UploadedDocument } from '../types';
import { formatFileSize } from '../utils/validateUpload';
import { StatusBadge } from './StatusBadge';

interface UploadQueueProps {
  items: UploadedDocument[];
  className?: string;
}

export function UploadQueue({ items, className }: UploadQueueProps) {
  if (items.length === 0) return null;

  return (
    <Card className={cn('border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="pb-2">
        <CardTitle>Arquivos selecionados</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-doqyn-border">
                <th className="px-5 py-3 text-xs font-medium text-doqyn-muted">Arquivo original</th>
                <th className="px-4 py-3 text-xs font-medium text-doqyn-muted">Tamanho</th>
                <th className="px-4 py-3 text-xs font-medium text-doqyn-muted">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-doqyn-muted">Nome sugerido</th>
                <th className="px-5 py-3 text-xs font-medium text-doqyn-muted">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-doqyn-border-subtle last:border-0 hover:bg-doqyn-hover"
                >
                  <td className="max-w-[180px] truncate px-5 py-3.5 font-medium text-doqyn-text">
                    {item.originalName}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-doqyn-muted">
                    {formatFileSize(item.fileSize)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3.5 text-xs text-doqyn-muted">
                    {item.suggestedName ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-doqyn-muted transition-colors hover:bg-white/[0.06] hover:text-doqyn-text"
                      aria-label={`Ações para ${item.originalName}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
