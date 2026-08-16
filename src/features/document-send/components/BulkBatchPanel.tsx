import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { BulkBatchPhase, BulkUploadItem } from '../types/bulk';
import type { PerItemNamingChoice, WorkflowReviewSettings } from '../types/reviewWorkflowSettings';
import { policyRequiresPerItemChoice } from '../utils/reviewWorkflowSettings';
import { canBulkManualConfirm, computeBulkStats } from '../utils/bulkEligibility';
import { formatFileSize } from '../utils/validateUpload';
import { BulkQueueItemRow } from './BulkQueueItemRow';
import { DocumentNamingSection } from './DocumentNamingSection';
import { flowPanelContentClass } from './flowPanelShell';

interface BulkBatchPanelProps {
  items: BulkUploadItem[];
  batchPhase: BulkBatchPhase;
  currentItem: BulkUploadItem | null;
  autoCountdown: number | null;
  manualGate: boolean;
  statusMessage: string | null;
  reviewSettings: WorkflowReviewSettings;
  isAuthenticated: boolean;
  onPerItemNamingChange: (choice: PerItemNamingChoice) => void;
  onCancelAuto?: () => void;
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
  embedded?: boolean;
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
  batchPhase,
  currentItem,
  autoCountdown,
  manualGate,
  statusMessage,
  reviewSettings,
  isAuthenticated,
  onPerItemNamingChange,
  onCancelAuto,
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
  embedded = false,
  className,
}: BulkBatchPanelProps) {
  const stats = computeBulkStats(items);
  const isCompleted = batchPhase === 'completed' || batchPhase === 'cancelled';
  const processedCount = stats.saved + stats.requiresReview + stats.errors + stats.skipped;

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
      settings: reviewSettings,
      perItem: currentItem.perItemNaming,
    });

  const showNamingGate =
    manualGate &&
    Boolean(currentItem?.result) &&
    (policyRequiresPerItemChoice(reviewSettings.defaultNamingPolicy) ||
      reviewSettings.defaultNamingPolicy === 'manual_required');

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

  const shellClass = flowPanelContentClass(
    embedded,
    cn('flex h-full min-h-0 w-full flex-col overflow-hidden', className),
  );

  const content = (
    <>
      <CardHeader className="shrink-0 space-y-4 border-b border-doqyn-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{isCompleted ? 'Lote concluído' : 'Lote em processamento'}</CardTitle>
            <p className="mt-1 text-xs text-doqyn-muted">
              {isCompleted
                ? `${stats.total} arquivos no lote`
                : `${processedCount} de ${stats.total} documentos processados`}
              {!isCompleted && reviewSettings.autoReviewEnabled && ' · Auto ligado'}
            </p>
          </div>
          {batchPhase === 'running' && (
            <Icon
              name="progress_activity"
              size={ICON_SIZE.xs}
              className="animate-spin text-doqyn-muted"
            />
          )}
        </div>

        <BatchSummaryBar items={items} />

        {statusMessage && (
          <p className="flow-enter rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-xs text-doqyn-text">
            {statusMessage}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {currentItem && !isCompleted && (
              <div className="flow-enter rounded-lg border border-doqyn-primary/30 bg-doqyn-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-doqyn-muted">
                  Documento atual
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-card">
                    <Icon name="description" size={ICON_SIZE.nav} className="text-doqyn-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TruncatedText as="p" className="text-sm font-medium text-doqyn-text">
                      {currentItem.originalFileName}
                    </TruncatedText>
                    <p className="text-xs text-doqyn-muted">
                      {formatFileSize(currentItem.sizeBytes)}
                    </p>
                    {currentItem.className && (
                      <p className="mt-1 text-xs text-doqyn-muted">
                        Classe: <span className="text-doqyn-text">{currentItem.className}</span>
                      </p>
                    )}
                    {currentItem.recommendedFileName && (
                      <TruncatedText as="p" className="mt-1 font-mono text-xs text-doqyn-text">
                        {`Nome sugerido: ${currentItem.recommendedFileName}`}
                      </TruncatedText>
                    )}
                    {autoCountdown !== null && autoCountdown > 0 && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs font-medium text-doqyn-text">
                          Auto ativo: salvando em {autoCountdown}s...
                        </p>
                        {onCancelAuto && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancelAuto}
                            className="h-7 px-2 text-xs text-doqyn-muted"
                          >
                            Cancelar auto
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showNamingGate && currentItem?.result && (
              <DocumentNamingSection
                settings={reviewSettings}
                originalFileName={currentItem.result.originalFileName}
                aiSuggestedFileName={
                  currentItem.result.recommendedFileName ?? currentItem.result.originalFileName
                }
                perItemChoice={currentItem.perItemNaming ?? { namingMode: 'ai_suggested' }}
                onPerItemChoiceChange={onPerItemNamingChange}
              />
            )}

            {isCompleted && (
              <div className="flow-enter rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
                <Icon name="check_circle" size={32} className="mx-auto text-emerald-500" />
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

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-doqyn-border-subtle bg-doqyn-surface px-6 py-4 shadow-sticky-footer">
            {isCompleted ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={onNewBatch}>
                  Novo lote
                </Button>
                <Button type="button" variant="secondary" onClick={onClearCompleted}>
                  Limpar concluídos
                </Button>
                <Button type="button" variant="ghost" onClick={() => void copySummary()}>
                  <Icon name="content_copy" size={ICON_SIZE.xs} />
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
                      <Icon name="check_circle" size={ICON_SIZE.xs} />
                      Confirmar e continuar
                    </Button>
                    <Button type="button" variant="secondary" onClick={onSkip}>
                      <Icon name="skip_next" size={ICON_SIZE.xs} />
                      Pular documento
                    </Button>
                    <Button type="button" variant="secondary" onClick={onReprocess}>
                      <Icon name="refresh" size={ICON_SIZE.xs} />
                      Reprocessar
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {batchPhase === 'running' ? (
                    <Button type="button" variant="secondary" onClick={onPause}>
                      <Icon name="pause" size={ICON_SIZE.xs} />
                      Pausar lote
                    </Button>
                  ) : batchPhase === 'paused' ? (
                    <Button type="button" variant="secondary" onClick={onResume}>
                      <Icon name="play_arrow" size={ICON_SIZE.xs} />
                      Retomar lote
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={onCancel}>
                    <Icon name="cancel" size={ICON_SIZE.xs} />
                    Cancelar lote
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </>
  );

  if (embedded) {
    return <div className={shellClass}>{content}</div>;
  }

  return <Card className={shellClass}>{content}</Card>;
}
