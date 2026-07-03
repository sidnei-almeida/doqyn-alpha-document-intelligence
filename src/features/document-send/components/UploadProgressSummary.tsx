import { useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';
import type { UploadProgressViewModel } from '../utils/uploadProgress';
import { formatFileSize } from '../utils/validateUpload';

type UploadProgressSummaryProps = {
  state: UploadProgressViewModel;
  canViewTracking?: boolean;
  trackingHref?: string | null;
  canShowTechnicalDetails?: boolean;
  technicalDetails?: Record<string, unknown>;
  technicalHint?: string;
  onRetry?: () => void;
  onReview?: () => void;
  onViewDocument?: () => void;
  className?: string;
};

export function UploadProgressSummary({
  state,
  canViewTracking = false,
  trackingHref = null,
  canShowTechnicalDetails = false,
  technicalDetails,
  technicalHint,
  onRetry,
  onReview,
  onViewDocument,
  className,
}: UploadProgressSummaryProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const isFailed = state.status === 'failed';
  const showPercent = state.status !== 'idle';
  const safeTechnicalDetails = technicalDetails
    ? Object.fromEntries(
        Object.entries(technicalDetails).filter(
          ([key]) =>
            !/token|secret|password|objectKey|payload|hash/i.test(key),
        ),
      )
    : undefined;

  return (
    <section
      className={cn(
        'shrink-0 rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-4 shadow-card',
        isFailed && 'border-doqyn-danger-border/50 bg-doqyn-danger-bg/20',
        className,
      )}
      aria-label="Progresso do envio"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-doqyn-text">Progresso do envio</h2>
          <p className="mt-0.5 text-sm text-doqyn-text">{state.label}</p>
        </div>
        {showPercent && (
          <span className="text-sm font-medium tabular-nums text-doqyn-muted">
            {isFailed ? 'Erro' : `${Math.round(state.percent)}%`}
          </span>
        )}
      </div>

      {showPercent && (
        <Progress
          className="mt-3"
          value={isFailed ? state.percent : state.percent}
          label={state.label}
        />
      )}

      {state.fileName && (
        <p className="mt-3 truncate text-sm font-medium text-doqyn-text" title={state.fileName}>
          {state.fileName}
          {typeof state.fileSize === 'number' && state.fileSize > 0 ? (
            <span className="ml-2 text-xs font-normal text-doqyn-muted">
              {formatFileSize(state.fileSize)}
            </span>
          ) : null}
        </p>
      )}

      <p
        className={cn(
          'mt-2 text-sm',
          isFailed ? 'text-doqyn-danger' : 'text-doqyn-muted',
        )}
        role={isFailed ? 'alert' : 'status'}
      >
        {state.message}
      </p>

      {state.recentSteps && state.recentSteps.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-doqyn-border-subtle pt-3 text-xs text-doqyn-muted">
          <li className="font-medium text-doqyn-text">Últimas etapas</li>
          {state.recentSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isFailed && onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}

        {state.status === 'review_required' && onReview && (
          <Button type="button" size="sm" onClick={onReview}>
            Revisar documento
          </Button>
        )}

        {state.status === 'completed' && onViewDocument && (
          <Button type="button" variant="secondary" size="sm" onClick={onViewDocument}>
            Ver documento
          </Button>
        )}

        {canViewTracking && trackingHref && (
          <Link
            to={trackingHref}
            className="inline-flex items-center gap-1 text-xs text-doqyn-muted transition-colors hover:text-doqyn-text"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver tracking completo
          </Link>
        )}

        {isFailed && canShowTechnicalDetails && (technicalHint || safeTechnicalDetails) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-doqyn-muted"
            onClick={() => setShowTechnical((value) => !value)}
          >
            {showTechnical ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
          </Button>
        )}
      </div>

      {showTechnical && canShowTechnicalDetails && (
        <div className="mt-3 rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 p-3 text-left text-xs text-doqyn-muted">
          {technicalHint && <p className="mb-2">{technicalHint}</p>}
          {safeTechnicalDetails && Object.keys(safeTechnicalDetails).length > 0 && (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
              {JSON.stringify(safeTechnicalDetails, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
