import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  wrapperClassName?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, disabled, wrapperClassName, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          'group flex cursor-pointer items-start gap-3',
          disabled && 'cursor-not-allowed opacity-50',
          wrapperClassName,
        )}
      >
        <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="radio"
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border border-doqyn-border bg-doqyn-bg transition-colors',
              'group-hover:border-doqyn-border-strong',
              'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-doqyn-accent-active/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-doqyn-bg',
              'peer-checked:border-doqyn-primary',
              'peer-disabled:group-hover:border-doqyn-border',
              className,
            )}
          >
            <span className="h-2 w-2 rounded-full bg-doqyn-primary opacity-0 transition-opacity group-has-[:checked]:opacity-100" />
          </span>
        </span>
        {(label || description) && (
          <span className="min-w-0 flex-1">
            {label ? <span className="block text-sm text-doqyn-text">{label}</span> : null}
            {description ? (
              <span className="mt-0.5 block text-xs text-doqyn-muted">{description}</span>
            ) : null}
          </span>
        )}
      </label>
    );
  },
);
Radio.displayName = 'Radio';

export const AppRadio = Radio;
