import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import type { ProcessingStep } from '../utils/processingSteps';

interface ProcessingStepTimelineProps {
  steps: ProcessingStep[];
  className?: string;
}

export function ProcessingStepTimeline({ steps, className }: ProcessingStepTimelineProps) {
  return (
    <ol className={cn('space-y-2', className)} aria-label="Etapas do processamento">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-1.5 transition-all duration-300',
            step.status === 'active' && 'bg-doqyn-primary/5',
            step.status === 'pending' && 'opacity-45',
          )}
        >
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-300',
              step.status === 'done' &&
                'border-doqyn-primary/40 bg-doqyn-primary/15 text-doqyn-primary',
              step.status === 'active' &&
                'border-doqyn-primary/60 bg-doqyn-primary/10 text-doqyn-primary doc-step-active',
              step.status === 'pending' && 'border-doqyn-border bg-doqyn-bg/40 text-doqyn-muted',
            )}
          >
            {step.status === 'done' ? (
              <Icon name="check" size={12} weight={600} />
            ) : (
              <span>{index + 1}</span>
            )}
          </span>
          <span
            className={cn(
              'text-xs transition-colors duration-300',
              step.status === 'active' && 'font-medium text-doqyn-text',
              step.status === 'done' && 'text-doqyn-text',
              step.status === 'pending' && 'text-doqyn-muted',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
