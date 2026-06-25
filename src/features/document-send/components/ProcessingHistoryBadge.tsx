import { cn } from '@/lib/utils';
import type { HistoryStatus } from '../types';

type DisplayStatus = 'completed' | 'processing' | 'error' | 'review';

const DISPLAY_CONFIG: Record<
  DisplayStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  completed: {
    label: 'Concluído',
    className: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
  },
  processing: {
    label: 'Processando',
    className: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
    pulse: true,
  },
  error: {
    label: 'Erro',
    className: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
  },
  review: {
    label: 'Requer revisão',
    className: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
  },
};

function mapHistoryStatus(status: HistoryStatus): DisplayStatus {
  if (status === 'analyzing') return 'processing';
  if (status === 'error') return 'error';
  if (status === 'requires_review') return 'review';
  return 'completed';
}

interface ProcessingHistoryBadgeProps {
  status: HistoryStatus;
  className?: string;
}

export function ProcessingHistoryBadge({ status, className }: ProcessingHistoryBadgeProps) {
  const display = mapHistoryStatus(status);
  const config = DISPLAY_CONFIG[display];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium',
        config.className,
        config.pulse && 'animate-pulse',
        className,
      )}
    >
      {config.label}
    </span>
  );
}
