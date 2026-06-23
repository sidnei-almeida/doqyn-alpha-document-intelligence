import { cn } from '@/lib/utils';
import type { HistoryStatus, ProcessingStatus } from '../types';

const NEUTRAL = 'border-doqyn-border bg-doqyn-card text-doqyn-muted';
const INFO = 'border-doqyn-border bg-doqyn-card text-doqyn-muted';
const SUCCESS = 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success';
const WARNING = 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning';
const DANGER = 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger';

const QUEUE_STATUS_CONFIG: Record<ProcessingStatus, { label: string; className: string }> = {
  waiting: { label: 'Aguardando análise', className: NEUTRAL },
  validating: { label: 'Validando', className: INFO },
  processing: { label: 'Analisando', className: INFO },
  metadata_extracted: { label: 'Metadados extraídos', className: INFO },
  name_generated: { label: 'Nome gerado', className: SUCCESS },
  requires_review: { label: 'Requer revisão', className: WARNING },
  confirmed: { label: 'Confirmado', className: SUCCESS },
  error: { label: 'Erro', className: DANGER },
};

const HISTORY_STATUS_CONFIG: Record<HistoryStatus, { label: string; className: string }> = {
  processed: { label: 'Processado', className: SUCCESS },
  analyzing: { label: 'Em análise', className: INFO },
  metadata_confirmed: { label: 'Metadados confirmados', className: INFO },
  requires_review: { label: 'Requer revisão', className: WARNING },
  error: { label: 'Erro', className: DANGER },
};

interface StatusBadgeProps {
  status: ProcessingStatus | HistoryStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config =
    status in QUEUE_STATUS_CONFIG
      ? QUEUE_STATUS_CONFIG[status as ProcessingStatus]
      : HISTORY_STATUS_CONFIG[status as HistoryStatus];

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
