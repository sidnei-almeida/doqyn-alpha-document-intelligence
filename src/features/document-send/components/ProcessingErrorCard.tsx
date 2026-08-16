import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { Button } from '@/components/ui/Button';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { WorkflowErrorAction } from '../types/workflowError';
import { formatFileSize } from '../utils/validateUpload';
import { shouldShowDevHint } from '../utils/workflowErrors';

import { flowPanelContentClass } from './flowPanelShell';

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
  embedded?: boolean;
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
  embedded = false,
  className,
}: ProcessingErrorCardProps) {
  const showDevHint = devHint && shouldShowDevHint(showDebug);

  const shellClass = flowPanelContentClass(
    embedded,
    cn('flex min-h-0 flex-1 flex-col', !embedded && 'border-doqyn-danger-border/40', className),
  );

  const content = (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-6 py-10 text-center',
        !embedded && 'min-h-[300px]',
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-doqyn-danger-bg">
        <Icon name="warning" size={24} className="text-doqyn-danger" />
      </div>
      <h2 className="mt-5 text-base font-semibold text-doqyn-text">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-doqyn-muted">{message}</p>
      {suggestion && <p className="mt-2 max-w-md text-sm text-doqyn-text">{suggestion}</p>}
      <TruncatedText as="p" className="mt-3 text-xs text-doqyn-muted">
        {`${fileName} · ${formatFileSize(fileSize)}`}
      </TruncatedText>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {action && (
          <Link to={action.href} className={buttonVariants({ variant: 'primary' })}>
            <Icon name="open_in_new" size={ICON_SIZE.xs} />
            {action.label}
          </Link>
        )}
        <Button type="button" variant={action ? 'secondary' : 'primary'} onClick={onRetry}>
          <Icon name="refresh" size={ICON_SIZE.xs} />
          Tentar novamente
        </Button>
        <Button type="button" variant="secondary" onClick={onChooseAnother}>
          <Icon name="upload" size={ICON_SIZE.xs} />
          Escolher outro documento
        </Button>
      </div>
      {showDevHint && (
        <p className="bg-doqyn-bg/40 mt-4 max-w-md rounded-md border border-doqyn-border-subtle px-3 py-2 text-left text-xs text-doqyn-muted">
          {devHint}
        </p>
      )}
      {showDebug && debugDetails && Object.keys(debugDetails).length > 0 && (
        <dl className="bg-doqyn-bg/30 mt-4 w-full max-w-md rounded-md border border-doqyn-border-subtle px-3 py-2 text-left text-micro text-doqyn-muted">
          {Object.entries(debugDetails).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 py-0.5">
              <dt className="font-medium text-doqyn-text">{key}:</dt>
              <dd className="break-all">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  if (embedded) {
    return <div className={shellClass}>{content}</div>;
  }

  return <Card className={shellClass}>{content}</Card>;
}
