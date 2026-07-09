import { forwardRef, type InputHTMLAttributes } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, label, error, id, placeholder, ...props }, ref) => (
    <div className={fieldWrapperClass}>
      {label && (
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="date"
          placeholder={placeholder}
          className={cn(
            fieldControlClass,
            'date-input pr-9 [color-scheme:light_dark]',
            error && 'border-doqyn-danger focus-visible:ring-doqyn-danger/30',
            className,
          )}
          {...props}
        />
        <Icon
          name="calendar_today"
          size={ICON_SIZE.sm}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-doqyn-muted"
        />
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  ),
);
DateInput.displayName = 'DateInput';
