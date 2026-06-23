import { cn } from '@/lib/utils';
import { AlertCircle, Check, Circle, Loader2 } from 'lucide-react';
import type { ProcessingLogItem } from '../types';

interface TimelineItemProps {
  log: ProcessingLogItem;
  isLast?: boolean;
}

export function TimelineItem({ log, isLast = false }: TimelineItemProps) {
  const isDone = log.status === 'done';
  const isActive = log.status === 'active';
  const isError = log.status === 'error';

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && (
        <span
          className={cn(
            'absolute left-[11px] top-6 h-[calc(100%-4px)] w-px',
            isDone ? 'bg-doqyn-action/40' : 'bg-doqyn-border',
          )}
          aria-hidden
        />
      )}

      <span
        className={cn(
          'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          isDone && 'border-doqyn-primary bg-doqyn-text text-doqyn-bg',
          isActive && 'border-doqyn-primary bg-doqyn-primary-bg text-doqyn-primary',
          isError && 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
          !isDone && !isActive && !isError && 'border-doqyn-border-strong bg-doqyn-surface text-doqyn-muted',
        )}
        aria-hidden
      >
        {isDone && <Check className="h-3 w-3" strokeWidth={2.5} />}
        {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
        {isError && <AlertCircle className="h-3 w-3" />}
        {!isDone && !isActive && !isError && <Circle className="h-2 w-2 fill-current" />}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              'text-sm font-medium leading-snug',
              isDone || isActive ? 'text-doqyn-text' : 'text-doqyn-muted',
              isError && 'text-doqyn-danger',
            )}
          >
            {log.title}
          </p>
          {log.time && (
            <time className="shrink-0 font-mono text-xs text-doqyn-muted" dateTime={log.time}>
              {log.time}
            </time>
          )}
        </div>
        {log.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-doqyn-muted">{log.description}</p>
        )}
      </div>
    </li>
  );
}
