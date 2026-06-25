import { useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { DocumentHistoryItem } from '../types';
import { metadataToFields } from '../utils/documentNaming';
import { formatFileSizeLabel } from '../utils/historyFormat';
import { ConfidenceBadge } from './ConfidenceBadge';
import { TimelineItem } from './TimelineItem';

interface HistoryAnalysisDrawerProps {
  item: DocumentHistoryItem | null;
  open: boolean;
  onClose: () => void;
}

export function HistoryAnalysisDrawer({ item, open, onClose }: HistoryAnalysisDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !item) return null;

  const metadata = item.metadata;
  const summaryFields = metadata ? metadataToFields(metadata) : [];
  const pageCount = metadata?.textExtraction?.pageCount;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
        aria-label="Fechar painel de análise"
        onClick={onClose}
      />
      <aside
        className={cn(
          'history-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col',
          'border-l border-doqyn-border bg-doqyn-surface shadow-modal',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-drawer-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="history-drawer-title" className="text-sm font-semibold text-doqyn-text">
              Análise do documento
            </h2>
            <p className="mt-1 truncate text-xs text-doqyn-muted" title={item.originalName}>
              {item.originalName}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-doqyn-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          <div className="flex flex-wrap items-center gap-2 text-xs text-doqyn-muted">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {formatFileSizeLabel(item.fileSize)}
            </span>
            {pageCount !== undefined && <span>{pageCount} página{pageCount === 1 ? '' : 's'}</span>}
            {metadata && <ConfidenceBadge score={metadata.confidenceScore} />}
          </div>

          {item.errorMessage && (
            <div className="mt-4 rounded-lg border border-doqyn-danger-border bg-doqyn-danger-bg px-3 py-2.5 text-xs text-doqyn-danger">
              {item.errorMessage}
            </div>
          )}

          {metadata && summaryFields.length > 0 && (
            <div className="mt-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40">
              <p className="border-b border-doqyn-border-subtle px-3 py-2 text-xs font-medium text-doqyn-text">
                Resumo da análise
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {summaryFields.map((field) => (
                    <tr
                      key={field.label}
                      className="border-b border-doqyn-border-subtle last:border-0"
                    >
                      <td className="w-[42%] px-3 py-2 align-top text-xs text-doqyn-muted">
                        {field.label}
                      </td>
                      <td className="px-3 py-2 text-xs text-doqyn-text">
                        <span className="line-clamp-3 break-words" title={field.value}>
                          {field.value}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {metadata?.classificationEvidence && metadata.classificationEvidence.length > 0 && (
            <div className="mt-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-3">
              <p className="text-xs font-medium text-doqyn-text">Evidências da classificação</p>
              <ul className="mt-2 space-y-2">
                {metadata.classificationEvidence.map((evidence, index) => (
                  <li key={`${evidence.snippet}-${index}`} className="text-xs text-doqyn-muted">
                    {evidence.pageNumber ? `Página ${evidence.pageNumber}: ` : ''}
                    <span className="line-clamp-3">&ldquo;{evidence.snippet}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metadata?.extractedFields && metadata.extractedFields.length > 0 && (
            <div className="mt-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30">
              <p className="border-b border-doqyn-border-subtle px-3 py-2 text-xs font-medium text-doqyn-text">
                Metadados por campo
              </p>
              <ul className="divide-y divide-doqyn-border-subtle">
                {metadata.extractedFields.map((field) => (
                  <li key={field.key} className="px-3 py-2.5">
                    <p className="text-xs font-medium text-doqyn-text">{field.label}</p>
                    <p className="mt-1 break-words text-xs text-doqyn-muted">{field.value}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.logs && item.logs.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-doqyn-text">Logs de processamento</p>
              <ol className="space-y-0 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/20 px-3 py-2">
                {item.logs.map((log, index) => (
                  <TimelineItem
                    key={log.id}
                    log={log}
                    isLast={index === item.logs!.length - 1}
                  />
                ))}
              </ol>
            </div>
          )}

          {!metadata && !item.errorMessage && (
            <p className="mt-4 text-sm text-doqyn-muted">
              Nenhum detalhe de análise disponível para este item.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-doqyn-border px-5 py-4">
          <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </aside>
    </>
  );
}
