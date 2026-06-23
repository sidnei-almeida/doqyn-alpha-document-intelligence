import { cn, formatDate } from '@/lib/utils';
import { AUDIT_ACTION_LABELS, type AuditEvent } from '@/types/audit';
import { Badge } from './Badge';

const RESULT_VARIANTS = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
} as const;

const RESULT_LABELS: Record<keyof typeof RESULT_VARIANTS, string> = {
  success: 'Sucesso',
  warning: 'Atenção',
  error: 'Erro',
  info: 'Informação',
};

interface AuditEventItemProps {
  event: AuditEvent;
  isSelected?: boolean;
  onClick?: () => void;
}

export function AuditEventItem({ event, isSelected, onClick }: AuditEventItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md border p-3 text-left transition-colors',
        isSelected
          ? 'border-doqyn-primary/50 bg-doqyn-primary/5'
          : 'border-doqyn-border bg-doqyn-surface hover:bg-doqyn-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-doqyn-text">
            {AUDIT_ACTION_LABELS[event.action] ?? event.action}
          </p>
          <p className="mt-0.5 truncate text-xs text-doqyn-muted">{event.description}</p>
        </div>
        <Badge variant={RESULT_VARIANTS[event.result]}>{RESULT_LABELS[event.result]}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-doqyn-muted">
        <span>{event.actorName}</span>
        <span>·</span>
        <span>{event.area}</span>
        <span>·</span>
        <span>{formatDate(event.createdAt)}</span>
      </div>
    </button>
  );
}
