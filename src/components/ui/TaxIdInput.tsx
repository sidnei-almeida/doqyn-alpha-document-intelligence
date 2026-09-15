import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import { getTaxIdSpec, type CountryCode, type PersonType, type TaxIdSpec } from '@/lib/identifiers';
import { Input, type InputProps } from './Input';

export interface TaxIdInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  /** País do cadastro — decide máscara, rótulo e regra de completude. */
  country: CountryCode;
  personType: PersonType;
  value: string;
  onChange: (value: string) => void;
}

export function TaxIdInput({
  country,
  personType,
  value,
  onChange,
  error,
  ...props
}: TaxIdInputProps) {
  const { t } = useTranslation('common');

  const spec: TaxIdSpec = useMemo(() => getTaxIdSpec(country, personType), [country, personType]);

  const format = useCallback((raw: string) => spec.format(raw), [spec]);

  const inputProps = useFormattedInput({
    value,
    onChange,
    format,
  });

  const label = t(spec.labelKey);
  const validationError =
    value.length === 0
      ? undefined
      : !spec.isComplete(value)
        ? t('common:taxId.incomplete', { label })
        : !spec.isValid(value)
          ? t('common:taxId.invalid', { label })
          : undefined;

  return (
    <Input
      {...props}
      {...inputProps}
      // Só o CPF é numérico. CNPJ alfanumérico e documentos de fora do BR (NIF/CIF espanhol,
      // VAT europeu) têm letras.
      inputMode={country === 'BR' && personType === 'individual' ? 'numeric' : 'text'}
      autoComplete="off"
      placeholder={props.placeholder ?? t(spec.placeholderKey)}
      error={error ?? validationError}
    />
  );
}
