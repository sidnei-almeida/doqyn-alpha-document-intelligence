import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

interface TimelineStep {
  id: number;
  label: string;
  description?: string;
}

interface TimelineProps {
  steps: TimelineStep[];
  currentStep: number;
  className?: string;
}

export function Timeline({ steps, currentStep, className }: TimelineProps) {
  return (
    <ol className={cn('space-y-0', className)}>
      {steps.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  'absolute left-[11px] top-6 h-full w-px',
                  isCompleted ? 'bg-doqyn-primary/50' : 'bg-doqyn-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                isCompleted && 'border-doqyn-primary bg-doqyn-text text-doqyn-bg',
                isCurrent && 'border-doqyn-primary bg-doqyn-primary/10 text-doqyn-primary',
                !isCompleted && !isCurrent && 'border-doqyn-border bg-doqyn-surface text-doqyn-muted',
              )}
            >
              {isCompleted ? <Icon name="check" size={ICON_SIZE.xs} /> : step.id}
            </span>
            <div className="pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-doqyn-text' : 'text-doqyn-muted',
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-xs text-doqyn-muted">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
