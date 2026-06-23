import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-doqyn-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-doqyn-border bg-doqyn-bg px-3 py-2 text-sm text-doqyn-text placeholder:text-doqyn-subtle transition-colors hover:border-doqyn-border-strong focus-visible:border-doqyn-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-primary/30 disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-doqyn-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';
