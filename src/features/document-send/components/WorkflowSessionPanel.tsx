import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentHistoryItem } from '../types';
import type { WorkflowLogEvent, WorkflowLogFilter } from '../types/workflowLog';
import { ProcessingHistoryBadge } from './ProcessingHistoryBadge';
import { WorkflowLogRow } from './WorkflowLogRow';

const FILTERS: Array<{ id: WorkflowLogFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'errors', label: 'Erros' },
  { id: 'review', label: 'Revisão' },
  { id: 'saved', label: 'Salvos' },
  { id: 'current', label: 'Arquivo atual' },
];

interface WorkflowSessionPanelProps {
  events: WorkflowLogEvent[];
  filter: WorkflowLogFilter;
  onFilterChange: (filter: WorkflowLogFilter) => void;
  showDebug: boolean;
  onShowDebugChange: (show: boolean) => void;
  currentItemId?: string | null;
  historyItems: DocumentHistoryItem[];
  activeHistoryId?: string | null;
  onSelectHistoryItem?: (item: DocumentHistoryItem) => void;
  className?: string;
}

export function WorkflowSessionPanel({
  events,
  filter,
  onFilterChange,
  showDebug,
  onShowDebugChange,
  currentItemId = null,
  historyItems,
  activeHistoryId = null,
  onSelectHistoryItem,
  className,
}: WorkflowSessionPanelProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'documentos'>('logs');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 'logs' || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [events.length, activeTab]);

  return (
    <section
      className={cn(
        'sticky bottom-0 z-20 flex max-h-[35vh] shrink-0 flex-col overflow-hidden',
        'rounded-lg border border-doqyn-border bg-doqyn-surface shadow-[0_-2px_16px_rgba(0,0,0,0.12)]',
        className,
      )}
      aria-label="Logs e histórico da sessão"
    >
      <div className="shrink-0 border-b border-doqyn-border-subtle px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-doqyn-text">
            {activeTab === 'logs' ? 'Logs da sessão' : 'Histórico de Processamentos'}
            <span className="ml-1.5 font-normal text-doqyn-muted">
              ({activeTab === 'logs' ? events.length : historyItems.length})
            </span>
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                activeTab === 'logs'
                  ? 'bg-doqyn-primary/15 text-doqyn-text'
                  : 'text-doqyn-muted hover:text-doqyn-text',
              )}
            >
              <ScrollText className="mr-1 inline h-3.5 w-3.5" />
              Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documentos')}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                activeTab === 'documentos'
                  ? 'bg-doqyn-primary/15 text-doqyn-text'
                  : 'text-doqyn-muted hover:text-doqyn-text',
              )}
            >
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              Documentos
            </button>
          </div>
        </div>

        {activeTab === 'logs' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.id === 'current' && !currentItemId}
                onClick={() => onFilterChange(item.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  filter === item.id
                    ? 'border-doqyn-primary/40 bg-doqyn-primary/10 text-doqyn-text'
                    : 'border-doqyn-border-subtle text-doqyn-muted hover:text-doqyn-text',
                  item.id === 'current' && !currentItemId && 'cursor-not-allowed opacity-50',
                )}
              >
                {item.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-doqyn-muted">
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(event) => onShowDebugChange(event.target.checked)}
                className="rounded border-doqyn-border"
              />
              Debug
            </label>
          </div>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'logs' ? (
          events.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-doqyn-muted">
              Nenhum evento registrado nesta sessão. Os logs aparecerão aqui durante o envio.
            </p>
          ) : (
            <ol className="space-y-2 px-4 py-3">
              {events.map((event) => (
                <WorkflowLogRow key={event.id} event={event} />
              ))}
            </ol>
          )
        ) : historyItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-doqyn-muted">
            Nenhum documento processado ainda. Envie seu primeiro PDF acima.
          </p>
        ) : (
          <ul className="divide-y divide-doqyn-border-subtle">
            {historyItems.map((item) => {
              const isProcessing = item.status === 'analyzing';
              const isActive = activeHistoryId === item.id;
              const canSelect = !isProcessing && Boolean(onSelectHistoryItem);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!canSelect}
                    onClick={() => canSelect && onSelectHistoryItem?.(item)}
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
                      <p className="mt-0.5 text-xs text-doqyn-muted">
                        {item.uploadedAt}
                        {item.lastActionLabel ? ` · ${item.lastActionLabel}` : ''}
                      </p>
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
