import { ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentHistoryItem } from '../types';
import { ProcessingHistoryBadge } from './ProcessingHistoryBadge';

interface ProcessingHistoryPanelProps {
  items: DocumentHistoryItem[];
  activeId?: string | null;
  onSelectItem?: (item: DocumentHistoryItem) => void;
  className?: string;
}

export function ProcessingHistoryPanel({
  items,
  activeId = null,
  onSelectItem,
  className,
}: ProcessingHistoryPanelProps) {
  return (
    <section
      className={cn(
        'sticky bottom-0 z-20 flex max-h-[35vh] shrink-0 flex-col overflow-hidden',
        'rounded-lg border border-doqyn-border bg-doqyn-surface shadow-[0_-2px_16px_rgba(0,0,0,0.12)]',
        className,
      )}
      aria-label="Histórico de processamentos"
    >
      <div className="shrink-0 border-b border-doqyn-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-doqyn-text">
          Histórico de Processamentos
          {items.length > 0 && (
            <span className="ml-1.5 font-normal text-doqyn-muted">({items.length})</span>
          )}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-doqyn-muted">
            Nenhum documento processado ainda. Envie seu primeiro PDF acima.
          </p>
        ) : (
          <ul className="divide-y divide-doqyn-border-subtle">
            {items.map((item) => {
              const isProcessing = item.status === 'analyzing';
              const isActive = activeId === item.id;
              const canSelect = !isProcessing && Boolean(onSelectItem);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!canSelect}
                    onClick={() => canSelect && onSelectItem?.(item)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      canSelect && 'hover:bg-doqyn-hover',
                      isActive && 'bg-doqyn-primary/10',
                      !canSelect && 'cursor-default',
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-doqyn-bg/60">
                      <FileText className="h-4 w-4 text-doqyn-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-doqyn-text"
                        title={item.originalName}
                      >
                        {item.originalName}
                      </p>
                      <p className="mt-0.5 text-xs text-doqyn-muted">{item.uploadedAt}</p>
                    </div>

                    <ProcessingHistoryBadge status={item.status} />

                    {canSelect && (
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-doqyn-muted',
                          isActive && 'text-doqyn-primary',
                        )}
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
