import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className={fieldWrapperClass}>
      {label && (
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          fieldControlClass,
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
