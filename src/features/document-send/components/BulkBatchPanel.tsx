import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { BulkBatchPhase, BulkUploadItem } from '../types/bulk';
import type { WorkflowLogEvent } from '../types/workflowLog';
import { canBulkManualConfirm, computeBulkStats } from '../utils/bulkEligibility';
import { formatFileSize } from '../utils/validateUpload';
import { BulkQueueItemRow } from './BulkQueueItemRow';
import { WorkflowLogRow } from './WorkflowLogRow';

interface BulkBatchPanelProps {
  items: BulkUploadItem[];
  batchLogs: WorkflowLogEvent[];
  batchPhase: BulkBatchPhase;
  currentItem: BulkUploadItem | null;
  autoCountdown: number | null;
  manualGate: boolean;
  statusMessage: string | null;
  autoMode: boolean;
  isAuthenticated: boolean;
  onConfirmContinue: () => void;
  onSkip: () => void;
  onReprocess: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onNewBatch: () => void;
  onClearCompleted: () => void;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  className?: string;
}

function BatchSummaryBar({ items }: { items: BulkUploadItem[] }) {
  const stats = computeBulkStats(items);
  const done = stats.saved + stats.requiresReview + stats.errors + stats.skipped;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Total</p>
        <p className="font-medium text-doqyn-text">{stats.total}</p>
      </div>
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Processados</p>
        <p className="font-medium text-doqyn-text">{done}</p>
      </div>
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Salvos</p>
        <p className="font-medium text-doqyn-success">{stats.saved}</p>
      </div>
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Revisão</p>
        <p className="font-medium text-doqyn-warning">{stats.requiresReview}</p>
      </div>
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Erros</p>
        <p className="font-medium text-doqyn-danger">{stats.errors}</p>
      </div>
      <div className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
        <p className="text-doqyn-muted">Pendentes</p>
        <p className="font-medium text-doqyn-text">{stats.pending}</p>
      </div>
    </div>
  );
}

export function BulkBatchPanel({
  items,
  batchLogs,
  batchPhase,
  currentItem,
  autoCountdown,
  manualGate,
  statusMessage,
  autoMode,
  isAuthenticated,
  onConfirmContinue,
  onSkip,
  onReprocess,
  onPause,
  onResume,
  onCancel,
  onNewBatch,
  onClearCompleted,
  selectedItemId = null,
  onSelectItem,
  className,
}: BulkBatchPanelProps) {
  const [activeTab, setActiveTab] = useState<'fila' | 'logs'>('fila');
  const stats = computeBulkStats(items);
  const isCompleted = batchPhase === 'completed' || batchPhase === 'cancelled';
  const processedCount =
    stats.saved + stats.requiresReview + stats.errors + stats.skipped;

  const canConfirmCurrent =
    manualGate &&
    Boolean(currentItem) &&
    (currentItem?.status === 'analyzed' || currentItem?.status === 'requires_review') &&
    Boolean(currentItem.result) &&
    Boolean(currentItem.metadata) &&
    canBulkManualConfirm({
      isAuthenticated,
      metadata: currentItem.metadata ?? null,
      rawAnalysis: currentItem.result ?? null,
    });

  const copySummary = async () => {
    const text = [
      'Resumo do lote',
      `${stats.total} arquivos`,
      `${stats.saved} salvos`,
      `${stats.requiresReview} requerem revisão`,
      `${stats.errors} com erro`,
      `${stats.skipped} pulados`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <Card
      className={cn(
        'flow-enter flex h-full min-h-0 w-full flex-col overflow-hidden border-doqyn-border bg-doqyn-surface',
        className,
      )}
    >
      <CardHeader className="shrink-0 space-y-4 border-b border-doqyn-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{isCompleted ? 'Lote concluído' : 'Lote em processamento'}</CardTitle>
            <p className="mt-1 text-xs text-doqyn-muted">
              {isCompleted
                ? `${stats.total} arquivos no lote`
                : `${processedCount} de ${stats.total} documentos processados`}
              {!isCompleted && autoMode && ' · Auto ligado'}
            </p>
          </div>
          {batchPhase === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin text-doqyn-muted" />
          )}
        </div>

        <BatchSummaryBar items={items} />

        {statusMessage && (
          <p className="flow-enter rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-xs text-doqyn-text">
            {statusMessage}
          </p>
        )}

        <div className="flex gap-1 border-b border-doqyn-border">
          <button
            type="button"
            onClick={() => setActiveTab('fila')}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'fila'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Fila
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'logs'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Logs do lote
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {activeTab === 'logs' ? (
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4 scrollbar-thin">
            {batchLogs.length === 0 ? (
              <li className="rounded-md border border-doqyn-border-subtle bg-doqyn-bg/30 px-4 py-6 text-center text-xs text-doqyn-muted">
                Nenhum evento do lote ainda. Os logs aparecerão aqui durante o processamento.
              </li>
            ) : (
              batchLogs.map((log) => <WorkflowLogRow key={log.id} event={log} compact />)
            )}
          </ol>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 scrollbar-thin">
              {currentItem && !isCompleted && (
                <div className="flow-enter rounded-lg border border-doqyn-primary/30 bg-doqyn-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-doqyn-muted">
                    Documento atual
                  </p>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-surface-soft">
                      <FileText className="h-5 w-5 text-doqyn-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-doqyn-text" title={currentItem.originalFileName}>
                        {currentItem.originalFileName}
                      </p>
                      <p className="text-xs text-doqyn-muted">{formatFileSize(currentItem.sizeBytes)}</p>
                      {currentItem.className && (
                        <p className="mt-1 text-xs text-doqyn-muted">
                          Classe: <span className="text-doqyn-text">{currentItem.className}</span>
                        </p>
                      )}
                      {currentItem.recommendedFileName && (
                        <p className="mt-1 truncate font-mono text-xs text-doqyn-text" title={currentItem.recommendedFileName}>
                          Nome sugerido: {currentItem.recommendedFileName}
                        </p>
                      )}
                      {autoCountdown !== null && autoCountdown > 0 && (
                        <p className="mt-2 text-xs font-medium text-doqyn-text">
                          Auto ativo: salvando em {autoCountdown}s...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="flow-enter rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-medium text-doqyn-text">Lote concluído</p>
                  <p className="mt-1 text-xs text-doqyn-muted">
                    {stats.saved} salvos · {stats.requiresReview} revisão · {stats.errors} erros
                  </p>
                </div>
              )}

              <ul className="space-y-2">
                {items.map((item) => (
                  <BulkQueueItemRow
                    key={item.id}
                    item={item}
                    isCurrent={item.id === currentItem?.id}
                    isSelected={item.id === selectedItemId}
                    onSelect={onSelectItem ? () => onSelectItem(item.id) : undefined}
                  />
                ))}
              </ul>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-doqyn-border-subtle bg-doqyn-surface px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.18)]">
              {isCompleted ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" onClick={onNewBatch}>
                    Novo lote
                  </Button>
                  <Button type="button" variant="secondary" onClick={onClearCompleted}>
                    Limpar concluídos
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void copySummary()}>
                    <Copy className="h-4 w-4" />
                    Copiar resumo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {manualGate && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={!canConfirmCurrent}
                        onClick={onConfirmContinue}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar e continuar
                      </Button>
                      <Button type="button" variant="secondary" onClick={onSkip}>
                        <SkipForward className="h-4 w-4" />
                        Pular documento
                      </Button>
                      <Button type="button" variant="secondary" onClick={onReprocess}>
                        <RotateCcw className="h-4 w-4" />
                        Reprocessar
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {batchPhase === 'running' ? (
                      <Button type="button" variant="secondary" onClick={onPause}>
                        <Pause className="h-4 w-4" />
                        Pausar lote
                      </Button>
                    ) : batchPhase === 'paused' ? (
                      <Button type="button" variant="secondary" onClick={onResume}>
                        <Play className="h-4 w-4" />
                        Retomar lote
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" onClick={onCancel}>
                      <XCircle className="h-4 w-4" />
                      Cancelar lote
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
