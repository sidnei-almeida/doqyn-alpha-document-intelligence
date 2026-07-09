import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { formatFileSize } from '@/features/document-send/utils/validateUpload';
import type { UploadQueueItem, UploadQueueItemStatus } from './types';
import {
  countAwaitingReview,
  countSavedDocuments,
  isItemSavedInLibrary,
} from './queue/uploadQueueState';
import { useUploadQueueContext } from './uploadQueueContext';

const STATUS_LABELS: Record<UploadQueueItemStatus, string> = {
  queued: 'Na fila',
  analyzing: 'Analisando com IA…',
  review: 'Aguardando revisão',
  confirming: 'Salvando na Biblioteca…',
  done: 'Salvo na Biblioteca',
  error: 'Erro',
};

function StatusIcon({ status }: { status: UploadQueueItemStatus }) {
  if (status === 'analyzing' || status === 'confirming') {
    return (
      <Icon
        name="progress_activity"
        size={ICON_SIZE.sm}
        className="animate-spin text-doqyn-info"
      />
    );
  }
  if (status === 'done') {
    return <Icon name="check_circle" size={ICON_SIZE.sm} className="text-doqyn-success" />;
  }
  if (status === 'error') {
    return <Icon name="error" size={ICON_SIZE.sm} className="text-doqyn-danger" />;
  }
  if (status === 'review') {
    return <Icon name="visibility" size={ICON_SIZE.sm} className="text-doqyn-warning" />;
  }
  return <Icon name="description" size={ICON_SIZE.sm} className="text-doqyn-muted" />;
}

function QueueRow({
  item,
  autoCountdown,
}: {
  item: UploadQueueItem;
  autoCountdown: number | null;
}) {
  const { openReview, retryItem, removeItem, cancelAutoConfirm } = useUploadQueueContext();

  const subtitle = useMemo(() => {
    if (item.status === 'error' && item.errorMessage) return item.errorMessage;
    if (item.status === 'done' && item.documentId) {
      return `Salvo na Biblioteca · ${formatFileSize(item.fileSize)}`;
    }
    if (autoCountdown !== null) {
      return `Salvando automaticamente em ${autoCountdown}s · ${formatFileSize(item.fileSize)}`;
    }
    return `${STATUS_LABELS[item.status]} · ${formatFileSize(item.fileSize)}`;
  }, [item, autoCountdown]);

  return (
    <li className="flex items-center gap-3 border-t border-doqyn-border-subtle px-4 py-3 first:border-t-0">
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1">
        <TruncatedText as="p" className="text-[13px] font-medium text-doqyn-text">
          {item.fileName}
        </TruncatedText>
        <p className={cn('text-[11px]', item.status === 'error' ? 'text-doqyn-danger' : 'text-doqyn-muted')}>
          {subtitle}
        </p>
      </div>
      {autoCountdown !== null && (
        <button
          type="button"
          onClick={() => cancelAutoConfirm(item.id)}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
        >
          Pausar
        </button>
      )}
      {item.status === 'review' && autoCountdown === null && (
        <button
          type="button"
          onClick={() => openReview(item.id)}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-doqyn-info hover:bg-doqyn-surface-hover"
        >
          Revisar
        </button>
      )}
      {item.status === 'error' && (
        <button
          type="button"
          onClick={() => retryItem(item.id)}
          className="shrink-0 rounded-md p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
          aria-label="Tentar novamente"
        >
          <Icon name="replay" size={ICON_SIZE.sm} />
        </button>
      )}
      {(item.status === 'done' || item.status === 'error') && (
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          className="shrink-0 rounded-md p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
          aria-label="Remover da fila"
        >
          <Icon name="close" size={ICON_SIZE.sm} />
        </button>
      )}
    </li>
  );
}

/** Fila de uploads com progresso do lote e countdown de auto-confirmação. */
export function UploadQueueDrawer() {
  const { items, pendingCount, clearFinished, autoConfirmCountdown, reviewSettings } =
    useUploadQueueContext();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const savedCount = countSavedDocuments(items);
  const reviewCount = countAwaitingReview(items);
  const errorCount = items.filter((item) => item.status === 'error').length;
  const savedProgressCount = items.filter((item) => isItemSavedInLibrary(item)).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((savedProgressCount / totalCount) * 100) : 0;

  const headline = (() => {
    if (pendingCount > 0 && reviewCount > 0) {
      return `${reviewCount} ${reviewCount === 1 ? 'arquivo aguardando revisão' : 'arquivos aguardando revisão'}`;
    }
    if (pendingCount > 0) {
      return `${pendingCount} ${pendingCount === 1 ? 'arquivo em processamento' : 'arquivos em processamento'}`;
    }
    if (savedCount > 0) {
      return `${savedCount} ${savedCount === 1 ? 'documento salvo' : 'documentos salvos'} na Biblioteca`;
    }
    if (errorCount > 0) {
      return `${errorCount} ${errorCount === 1 ? 'upload com erro' : 'uploads com erro'}`;
    }
    return 'Fila de upload';
  })();

  return (
    <section
      className="queue-drawer-enter fixed bottom-5 right-5 z-[80] w-[380px] overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-modal"
      aria-label="Fila de upload"
      data-testid="upload-queue-drawer"
    >
      <header className="border-b border-doqyn-border-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="auto_awesome" size={ICON_SIZE.sm} className="shrink-0 text-doqyn-accent-active" />
            <p className="truncate text-[13px] font-semibold text-doqyn-text">{headline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip label="Preferências de upload">
              <Link
                to="/settings?section=upload-ia"
                className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
                aria-label="Preferências de upload"
              >
                <Icon name="settings" size={ICON_SIZE.sm} />
              </Link>
            </Tooltip>
            {pendingCount === 0 && (
              <button
                type="button"
                onClick={clearFinished}
                className="rounded-md px-2 py-1 text-[11px] text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
              aria-label={collapsed ? 'Expandir fila' : 'Recolher fila'}
            >
              <Icon
                name={collapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                size={ICON_SIZE.sm}
              />
            </button>
          </div>
        </div>
        {totalCount > 1 && (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-[10px] text-doqyn-subtle">
              <span>
                {savedProgressCount}/{totalCount} salvos na Biblioteca
              </span>
              {reviewSettings.autoReviewEnabled && (
                <span>Auto · {reviewSettings.autoAcceptDelaySeconds}s</span>
              )}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-doqyn-card">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: 'var(--accent-active)',
                }}
              />
            </div>
          </div>
        )}
      </header>
      <ul className={cn('max-h-72 overflow-y-auto scrollbar-thin', collapsed && 'hidden')}>
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            autoCountdown={
              autoConfirmCountdown?.itemId === item.id ? autoConfirmCountdown.secondsLeft : null
            }
          />
        ))}
      </ul>
    </section>
  );
}
