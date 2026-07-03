import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowLogEvent } from '../types/workflowLog';
import { WORKFLOW_STAGE_LABELS } from '../utils/workflowLogHelpers';
import { levelLabel } from '../hooks/useWorkflowLogger';
import {
  formatWorkflowLogDuration,
  sanitizeWorkflowDebugDetails,
} from '../utils/workflowLogRowFormat';

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
  showDebug?: boolean;
}

function readDetail(details: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = details?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function WorkflowLogRow({ event, compact = false, showDebug = false }: WorkflowLogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const details = event.details;
  const friendlyTitle = readDetail(details, 'friendlyTitle');
  const friendlyMessage = readDetail(details, 'friendlyMessage');
  const suggestion = readDetail(details, 'suggestion');
  const detail = readDetail(details, 'detail');
  const errorType = readDetail(details, 'errorType');
  const actionLabel = readDetail(details, 'actionLabel');
  const actionHref = readDetail(details, 'actionHref');
  const devHint = readDetail(details, 'devHint');
  const code = readDetail(details, 'code');
  const requestId = readDetail(details, 'requestId');
  const endpoint = readDetail(details, 'endpoint');

  if (event.level === 'debug' && !showDebug) {
    return null;
  }

  const displayMessage = friendlyTitle ?? event.message;
  const durationLabel = formatWorkflowLogDuration(details?.durationMs);
  const debugDetails = sanitizeWorkflowDebugDetails(details, showDebug);
  const hasDebugDetails = Object.keys(debugDetails).length > 0;

  return (
    <li
      className={cn(
        'rounded-md border text-xs',
        LEVEL_STYLES[event.level],
        compact && 'py-1',
      )}
    >
      <div
        className={cn(
          'grid w-full items-start gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[72px_minmax(120px,0.9fr)_minmax(0,2fr)_auto]',
          compact && 'py-1.5',
        )}
      >
        <span className="font-mono text-[10px] opacity-70 sm:pt-0.5">{event.timestamp}</span>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="rounded bg-doqyn-bg/50 px-1.5 py-0.5 text-[10px] text-doqyn-text">
            {WORKFLOW_STAGE_LABELS[event.stage]}
          </span>
          {event.level !== 'info' && (
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
              {levelLabel(event.level)}
            </span>
          )}
          {errorType && (
            <span className="rounded bg-doqyn-bg/50 px-1.5 py-0.5 text-[10px] text-doqyn-text">
              {errorType}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          {event.fileName && (
            <p className="truncate font-medium text-doqyn-text" title={event.fileName}>
              {event.fileName}
            </p>
          )}
          <p className={cn('break-words text-doqyn-text', event.level === 'debug' && 'opacity-80')}>
            {displayMessage}
          </p>
          {friendlyMessage && friendlyMessage !== displayMessage && (
            <p className="text-doqyn-muted">{friendlyMessage}</p>
          )}
          {detail && (
            <p className="text-doqyn-muted">
              <span className="font-medium text-doqyn-text">Detalhe:</span> {detail}
            </p>
          )}
          {suggestion && (
            <p className="text-doqyn-muted">
              <span className="font-medium text-doqyn-text">Ação sugerida:</span> {suggestion}
            </p>
          )}
          {actionLabel && actionHref && (
            <p>
              <Link
                to={actionHref}
                className="text-[11px] font-medium text-doqyn-primary underline-offset-2 hover:underline"
              >
                {actionLabel}
              </Link>
            </p>
          )}
          {devHint && showDebug && (
            <p className="text-[10px] italic text-doqyn-muted">{devHint}</p>
          )}
        </div>

        <div className="flex items-start justify-end gap-2 sm:pt-0.5">
          {durationLabel && <span className="text-[10px] opacity-70">{durationLabel}</span>}
          {hasDebugDetails && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-0.5 text-[10px] text-doqyn-muted hover:text-doqyn-text"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Ver detalhes
            </button>
          )}
        </div>
      </div>

      {showDebug && (code || requestId || endpoint) && (
        <div className="border-t border-doqyn-border-subtle/60 px-3 py-1.5 font-mono text-[10px] text-doqyn-muted">
          {code && <p>código: {code}</p>}
          {endpoint && <p>endpoint: {endpoint}</p>}
          {requestId && <p>requestId: {requestId}</p>}
        </div>
      )}

      {expanded && hasDebugDetails && (
        <div className="border-t border-doqyn-border-subtle/60 px-3 py-2 font-mono text-[10px] text-doqyn-muted">
          {Object.entries(debugDetails).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}
