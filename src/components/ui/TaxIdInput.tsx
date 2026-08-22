import { useCallback, useMemo } from 'react';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import {
  getTaxIdSpec,
  type CountryCode,
  type PersonType,
  type TaxIdSpec,
} from '@/lib/identifiers';
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
  const spec: TaxIdSpec = useMemo(
    () => getTaxIdSpec(country, personType),
    [country, personType],
  );

  const format = useCallback((raw: string) => spec.format(raw), [spec]);

  const inputProps = useFormattedInput({
    value,
    onChange,
    format,
  });

  const incomplete = value.length > 0 && !spec.isComplete(value);
  const validationError = incomplete ? `${spec.label} incompleto.` : undefined;

  return (
    <Input
      {...props}
      {...inputProps}
      // Fora do BR o documento pode ter letras (NIF/CIF espanhol, VAT europeu).
      inputMode={country === 'BR' ? 'numeric' : 'text'}
      autoComplete="off"
      placeholder={props.placeholder ?? spec.placeholder}
      error={error ?? validationError}
    />
  );
}
