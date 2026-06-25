import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ProcessingLogItem } from '../types';
import {
  buildSimulatedSteps,
  buildStepsFromLogs,
} from '../utils/processingSteps';
import { formatFileSize } from '../utils/validateUpload';
import { DocumentProcessingVisual } from './DocumentProcessingVisual';
import { ProcessingStepTimeline } from './ProcessingStepTimeline';

interface ProcessingCardProps {
  file: File;
  progress: number;
  logs?: ProcessingLogItem[];
  isCompleting?: boolean;
  simulatedStepIndex?: number;
  onCancel?: () => void;
  className?: string;
}

export function ProcessingCard({
  file,
  progress,
  logs = [],
  isCompleting = false,
  simulatedStepIndex = 0,
  onCancel,
  className,
}: ProcessingCardProps) {
  const steps =
    logs.length > 0 ? buildStepsFromLogs(logs) : buildSimulatedSteps(simulatedStepIndex);

  return (
    <Card
      className={cn(
        'flow-enter flex min-h-0 flex-1 flex-col overflow-hidden border-doqyn-border bg-doqyn-surface',
        'max-md:min-h-[40vh] max-md:flex-none',
        isCompleting && 'processing-card--complete',
        className,
      )}
    >
      <div className="relative h-0.5 w-full shrink-0 overflow-hidden bg-doqyn-bg">
        <div
          className={cn(
            'relative h-full rounded-full bg-doqyn-primary/70 transition-[width] duration-500 ease-out',
            !isCompleting && progress < 100 && 'processing-progress-indeterminate',
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex shrink-0 flex-col items-center lg:w-[42%]">
          <DocumentProcessingVisual isCompleting={isCompleting} />
          <div className="mt-5 w-full max-w-xs text-center">
            <p className="text-sm font-medium text-doqyn-text">
              {isCompleting ? 'Análise concluída' : 'Analisando documento'}
            </p>
            <p className="mt-1 text-xs text-doqyn-muted">
              {isCompleting
                ? 'Preparando resultado...'
                : 'Lendo o PDF e identificando metadados relevantes.'}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-doqyn-text" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-doqyn-muted">{formatFileSize(file.size)}</p>
            </div>
            {onCancel && !isCompleting && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="shrink-0 text-doqyn-muted hover:text-doqyn-text"
                aria-label="Trocar documento"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ProcessingStepTimeline steps={steps} />
        </div>
      </div>
    </Card>
  );
}
