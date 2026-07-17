import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import {
  getIdentifierSpec,
  type CountryCode,
  type PersonType,
} from '@/lib/identifiers/countryIdentifiers';
import { Input, type InputProps } from './Input';

export interface DocumentIdInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  country: CountryCode;
  personType: PersonType;
  value: string;
  onChange: (value: string) => void;
}

export function DocumentIdInput({
  country,
  personType,
  value,
  onChange,
  error,
  ...props
}: DocumentIdInputProps) {
  const { t } = useTranslation('identifiers');
  const spec = useMemo(() => getIdentifierSpec(country, personType), [country, personType]);

  const format = useCallback((raw: string) => spec.format(raw), [spec]);

  const inputProps = useFormattedInput({
    value,
    onChange,
    format,
  });

  const incomplete = value.length > 0 && !spec.isComplete(value);
  const validationError = incomplete
    ? t('incomplete', { doc: t(spec.labelKey) })
    : undefined;

  return (
    <Input
      {...props}
      {...inputProps}
      inputMode={spec.inputMode}
      autoComplete="off"
      placeholder={props.placeholder ?? spec.placeholder}
      error={error ?? validationError}
    />
  );
}
