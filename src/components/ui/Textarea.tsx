import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** `boxed` para formulários antigos, `rule` para o papel pautado do sistema. */
  variant?: 'boxed' | 'rule';
}

const BOXED_CLASS =
  'flex min-h-[80px] w-full rounded-[4px] border border-doqyn-border-subtle bg-doqyn-surface px-3 py-2 type-body text-doqyn-text placeholder:text-doqyn-disabled transition-colors hover:border-doqyn-border focus-visible:border-doqyn-accent-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/20 disabled:cursor-not-allowed disabled:opacity-40';

/** No `rule` o campo é papel pautado: sem caixa, fio embaixo e acento no foco. */
const RULE_CLASS =
  'field-rule flex min-h-[72px] w-full resize-y border-0 border-b border-doqyn-border-subtle bg-transparent px-0 py-1.5 type-body text-doqyn-text placeholder:text-doqyn-subtle transition-colors hover:border-doqyn-border focus:border-b-2 focus:border-doqyn-accent-active focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, variant = 'boxed', ...props }, ref) => {
    const isRule = variant === 'rule';
    return (
      <div className={fieldWrapperClass}>
        {label ? (
          <label
            htmlFor={id}
            className={isRule ? 'register-label text-doqyn-subtle' : fieldLabelClass}
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            isRule ? RULE_CLASS : BOXED_CLASS,
            error && (isRule ? 'border-doqyn-danger' : 'border-doqyn-danger'),
            className,
          )}
          {...props}
        />
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
