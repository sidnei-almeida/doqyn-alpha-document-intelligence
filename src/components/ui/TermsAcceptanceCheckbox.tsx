import { Link } from 'react-router-dom';
import { Checkbox, type CheckboxProps } from '@/components/ui/Checkbox';
import { DOQYN_PRIVACY_ROUTE, DOQYN_TERMS_ROUTE } from '@/legal/terms';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('components');

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
          // 4px, e não `rounded-md`. O kit fixa o canto em 4px, e as quatro telas que montam
          // este bloco herdavam 8px daqui sem ter pedido — três delas já mandavam
          // `border-0 bg-transparent` para apagar a caixa, mas o raio sobrevivia à remoção da
          // borda e ficava marcando um retângulo invisível de canto redondo demais.
          'rounded-[4px] border border-doqyn-border-subtle bg-doqyn-bg px-3 py-3',
          error && 'border-red-500/40',
          wrapperClassName,
        )}
        label={
          <span className="text-sm leading-relaxed text-doqyn-muted">
            {label ?? (
              <>
                {t('termsAcceptanceCheckbox.liEAceitoOs')}{' '}
                <Link
                  to={termsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="font-medium text-doqyn-text underline-offset-4 hover:underline"
                >
                  {t('termsAcceptanceCheckbox.termosECondicoesDe')}
                </Link>
                {showPrivacy ? (
                  <>
                    {' '}
                    {t('termsAcceptanceCheckbox.eDeclaroCienciaDa')}{' '}
                    <Link
                      to={privacyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium text-doqyn-text underline-offset-4 hover:underline"
                    >
                      {t('termsAcceptanceCheckbox.politicaDePrivacidade')}
                    </Link>
                  </>
                ) : null}{' '}
                {t('termsAcceptanceCheckbox.doDoqyn')}
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
