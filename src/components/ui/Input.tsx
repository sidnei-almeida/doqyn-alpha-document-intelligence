import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Exibe botão para alternar visibilidade quando o tipo é password. */
  revealable?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, revealable = false, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === 'password';
    const showToggle = revealable && isPassword;
    const resolvedType = showToggle && revealed ? 'text' : type;

    return (
      <div className={fieldWrapperClass}>
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClass}>
            {label}
          </label>
        ) : null}
        <div className={cn(showToggle && 'relative')}>
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            className={cn(
              fieldControlClass,
              showToggle && 'pr-10',
              error && 'border-doqyn-danger focus-visible:ring-doqyn-danger/30',
              className,
            )}
            {...props}
          />
          {showToggle ? (
            <button
              type="button"
              className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-doqyn-muted transition-colors hover:text-doqyn-text disabled:opacity-40"
              onClick={() => setRevealed((value) => !value)}
              disabled={disabled}
              aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={revealed}
              tabIndex={-1}
            >
              <Icon name={revealed ? 'visibility_off' : 'visibility'} size={18} aria-hidden />
            </button>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
