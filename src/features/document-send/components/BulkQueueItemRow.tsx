import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/TruncatedText';
import type { BulkUploadItem } from '../types/bulk';
import { ProcessingHistoryBadge } from './ProcessingHistoryBadge';

const STATUS_MAP: Record<
  BulkUploadItem['status'],
  { label: string; historyStatus: 'analyzing' | 'metadata_confirmed' | 'requires_review' | 'error' | 'processed' }
> = {
  queued: { label: 'Na fila', historyStatus: 'processed' },
  analyzing: { label: 'Analisando', historyStatus: 'analyzing' },
  analyzed: { label: 'Analisado', historyStatus: 'processed' },
  auto_countdown: { label: 'Salvando...', historyStatus: 'analyzing' },
  saving: { label: 'Salvando', historyStatus: 'analyzing' },
  saved: { label: 'Salvo', historyStatus: 'metadata_confirmed' },
  requires_review: { label: 'Revisão', historyStatus: 'requires_review' },
  ai_paused: { label: 'IA indisponível', historyStatus: 'error' },
  unclassified: { label: 'Erro de análise', historyStatus: 'error' },
  error: { label: 'Erro', historyStatus: 'error' },
  skipped: { label: 'Pulado', historyStatus: 'processed' },
};

interface BulkQueueItemRowProps {
  item: BulkUploadItem;
  isCurrent?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function BulkQueueItemRow({
  item,
  isCurrent = false,
  isSelected = false,
  onSelect,
}: BulkQueueItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_MAP[item.status];
  const hasLogs = item.logs.length > 0;

  return (
    <li
      className={cn(
        'flow-enter rounded-lg border transition-colors',
        isCurrent || isSelected
          ? 'border-doqyn-primary/40 bg-doqyn-primary/5'
          : 'border-doqyn-border-subtle bg-doqyn-bg/20',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {hasLogs ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="shrink-0 text-doqyn-muted hover:text-doqyn-text"
            aria-label={expanded ? 'Recolher logs' : 'Expandir logs'}
          >
            {expanded ? (
              <Icon name="expand_more" size={ICON_SIZE.xs} />
            ) : (
              <Icon name="chevron_right" size={ICON_SIZE.xs} />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <button
          type="button"
          onClick={onSelect}
          disabled={!onSelect}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 text-left',
            onSelect && 'hover:opacity-90',
          )}
        >
          <div className="min-w-0 flex-1">
            <TruncatedText as="p" className="text-sm text-doqyn-text">
              {item.originalFileName}
            </TruncatedText>
            <p className="mt-0.5 truncate text-xs text-doqyn-muted">
              {item.className ?? '—'}
              {item.confidence !== undefined && ` · ${Math.round(item.confidence * 100)}%`}
              {item.errorMessage && ` · ${item.errorMessage}`}
            </p>
          </div>
          <span className="shrink-0 text-[10px] text-doqyn-muted">{config.label}</span>
          <ProcessingHistoryBadge status={config.historyStatus} />
        </button>
      </div>

      {expanded && hasLogs && (
        <ol className="space-y-1 border-t border-doqyn-border-subtle px-3 py-2">
          {item.logs.map((message, index) => (
            <li key={`${item.id}-log-${index}`} className="text-[11px] text-doqyn-muted">
              {message}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
