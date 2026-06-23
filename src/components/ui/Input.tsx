import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-doqyn-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'flex h-9 w-full rounded-md border border-doqyn-border bg-doqyn-surface px-3 text-sm text-doqyn-text placeholder:text-doqyn-disabled transition-colors hover:border-doqyn-border-strong focus-visible:border-doqyn-accent-active focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-border-strong disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-doqyn-danger focus-visible:ring-doqyn-danger/30',
          className,
        )}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
