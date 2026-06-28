import { AlertTriangle, ExternalLink, RotateCcw, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { WorkflowErrorAction } from '../types/workflowError';
import { formatFileSize } from '../utils/validateUpload';
import { shouldShowDevHint } from '../utils/workflowErrors';

interface ProcessingErrorCardProps {
  fileName: string;
  fileSize: number;
  title?: string;
  message: string;
  suggestion?: string;
  action?: WorkflowErrorAction;
  devHint?: string;
  showDebug?: boolean;
  debugDetails?: Record<string, unknown>;
  onRetry: () => void;
  onChooseAnother: () => void;
  className?: string;
}

export function ProcessingErrorCard({
  fileName,
  fileSize,
  title = 'Não foi possível analisar o documento',
  message,
  suggestion,
  action,
  devHint,
  showDebug = false,
  debugDetails,
  onRetry,
  onChooseAnother,
  className,
}: ProcessingErrorCardProps) {
  const showDevHint = devHint && shouldShowDevHint(showDebug);

  return (
    <Card
      className={cn(
        'flow-enter flex min-h-0 flex-1 flex-col border-doqyn-danger-border/40 bg-doqyn-surface',
        className,
      )}
    >
      <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-doqyn-danger-bg">
          <AlertTriangle className="h-6 w-6 text-doqyn-danger" />
        </div>
        <h2 className="mt-5 text-base font-semibold text-doqyn-text">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-doqyn-muted">{message}</p>
        {suggestion && (
          <p className="mt-2 max-w-md text-sm text-doqyn-text">{suggestion}</p>
        )}
        <p className="mt-3 truncate text-xs text-doqyn-muted" title={fileName}>
          {fileName} · {formatFileSize(fileSize)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {action && (
            <Link to={action.href} className={buttonVariants({ variant: 'primary' })}>
              <ExternalLink className="h-4 w-4" />
              {action.label}
            </Link>
          )}
          <Button type="button" variant={action ? 'secondary' : 'primary'} onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button type="button" variant="secondary" onClick={onChooseAnother}>
            <Upload className="h-4 w-4" />
            Escolher outro documento
          </Button>
        </div>
        {showDevHint && (
          <p className="mt-4 max-w-md rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-left text-xs text-doqyn-muted">
            {devHint}
          </p>
        )}
        {showDebug && debugDetails && Object.keys(debugDetails).length > 0 && (
          <dl className="mt-4 w-full max-w-md rounded-md border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-2 text-left text-[11px] text-doqyn-muted">
            {Object.entries(debugDetails).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 py-0.5">
                <dt className="font-medium text-doqyn-text">{key}:</dt>
                <dd className="break-all">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Card>
  );
}
