import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  wrapperClassName?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      label,
      description,
      disabled,
      className,
      wrapperClassName,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const switchId = id ?? generatedId;

    return (
      <div className={cn('flex items-start gap-3', wrapperClassName)}>
        <button
          ref={ref}
          id={switchId}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg',
            checked
              ? 'border-doqyn-primary/50 bg-doqyn-primary/25'
              : 'border-doqyn-border bg-doqyn-bg hover:border-doqyn-border-strong',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          {...props}
        >
          <span
            aria-hidden
            className={cn(
              'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-doqyn-text transition-transform duration-200',
              checked && 'translate-x-4 bg-doqyn-primary',
            )}
          />
        </button>
        {(label || description) && (
          <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
            {label ? <span className="block text-sm text-doqyn-text">{label}</span> : null}
            {description ? (
              <span className="mt-0.5 block text-xs text-doqyn-muted">{description}</span>
            ) : null}
          </label>
        )}
      </div>
    );
  },
);
Switch.displayName = 'Switch';

export const AppSwitch = Switch;
