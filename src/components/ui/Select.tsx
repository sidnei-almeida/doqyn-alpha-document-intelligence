import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-doqyn-muted">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          'flex h-9 w-full rounded-md border border-doqyn-border bg-doqyn-bg px-3 text-sm text-doqyn-text transition-colors hover:border-doqyn-border-strong focus-visible:border-doqyn-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-primary/30 disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-doqyn-danger',
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="form-error">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
