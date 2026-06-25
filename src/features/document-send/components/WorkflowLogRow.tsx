import { cn } from '@/lib/utils';
import type { WorkflowLogEvent } from '../types/workflowLog';
import { WORKFLOW_STAGE_LABELS, formatDurationMs } from '../utils/workflowLogHelpers';
import { levelLabel } from '../hooks/useWorkflowLogger';

const LEVEL_STYLES: Record<WorkflowLogEvent['level'], string> = {
  info: 'border-doqyn-border-subtle bg-doqyn-bg/30 text-doqyn-muted',
  success: 'border-doqyn-success-border bg-doqyn-success-bg/40 text-doqyn-success',
  warning: 'border-doqyn-warning-border bg-doqyn-warning-bg/40 text-doqyn-warning',
  error: 'border-doqyn-danger-border bg-doqyn-danger-bg/40 text-doqyn-danger',
  debug: 'border-doqyn-border-subtle bg-doqyn-bg/20 text-doqyn-muted opacity-70',
};

interface WorkflowLogRowProps {
  event: WorkflowLogEvent;
  compact?: boolean;
}

export function WorkflowLogRow({ event, compact = false }: WorkflowLogRowProps) {
  return (
    <li
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        LEVEL_STYLES[event.level],
        compact && 'py-1.5',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] opacity-70">{event.timestamp}</span>
        <span className="rounded bg-doqyn-bg/50 px-1.5 py-0.5 text-[10px] text-doqyn-text">
          {WORKFLOW_STAGE_LABELS[event.stage]}
        </span>
        {event.level !== 'info' && (
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
            {levelLabel(event.level)}
          </span>
        )}
        {event.fileName && (
          <span className="truncate font-medium text-doqyn-text" title={event.fileName}>
            {event.fileName}
          </span>
        )}
      </div>
      <p className={cn('mt-0.5 text-doqyn-text', event.level === 'debug' && 'opacity-80')}>
        {event.message}
      </p>
      {typeof event.details?.durationMs === 'number' && (
        <p className="mt-0.5 text-[10px] opacity-70">
          Processado em {formatDurationMs(event.details.durationMs)}
        </p>
      )}
    </li>
  );
}
