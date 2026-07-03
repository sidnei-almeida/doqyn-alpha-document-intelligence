import { Link } from 'react-router-dom';
import { Checkbox, type CheckboxProps } from '@/components/ui/Checkbox';
import { DOQYN_PRIVACY_ROUTE, DOQYN_TERMS_ROUTE } from '@/legal/terms';
import { cn } from '@/lib/utils';

type TermsAcceptanceCheckboxProps = Omit<CheckboxProps, 'label' | 'onChange' | 'checked'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
  termsHref?: string;
  privacyHref?: string;
  label?: string;
  helperText?: string;
};

export function TermsAcceptanceCheckbox({
  checked,
  onChange,
  error,
  disabled,
  termsHref = DOQYN_TERMS_ROUTE,
  privacyHref = DOQYN_PRIVACY_ROUTE,
  label,
  helperText = 'Recomendamos que você leia os termos antes de continuar.',
  required,
  wrapperClassName,
  ...props
}: TermsAcceptanceCheckboxProps) {
  const showPrivacy = Boolean(privacyHref);

  return (
    <div className="space-y-1.5">
      <Checkbox
        {...props}
        checked={checked}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.checked)}
        wrapperClassName={cn(
          'rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3',
          error && 'border-red-500/40',
          wrapperClassName,
        )}
        label={
          <span className="text-sm leading-relaxed text-doqyn-muted">
            {label ?? (
              <>
                Li e aceito os{' '}
                <Link
                  to={termsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="font-medium text-doqyn-text underline-offset-4 hover:underline"
                >
                  Termos e Condições de Uso
                </Link>
                {showPrivacy ? (
                  <>
                    {' '}
                    e declaro ciência da{' '}
                    <Link
                      to={privacyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium text-doqyn-text underline-offset-4 hover:underline"
                    >
                      Política de Privacidade
                    </Link>
                  </>
                ) : null}{' '}
                do DOQYN.
              </>
            )}
          </span>
        }
        description={helperText}
      />
      {error ? <p className="form-error text-xs">{error}</p> : null}
    </div>
  );
}
