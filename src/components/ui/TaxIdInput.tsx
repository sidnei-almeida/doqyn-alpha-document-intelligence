import { useCallback } from 'react';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import {
  formatTaxId,
  isCompleteTaxId,
  taxIdPlaceholder,
  type TaxIdKind,
} from '@/lib/identifiers';
import { Input, type InputProps } from './Input';

export interface TaxIdInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  kind: TaxIdKind;
  value: string;
  onChange: (value: string) => void;
}

export function TaxIdInput({ kind, value, onChange, error, ...props }: TaxIdInputProps) {
  const format = useCallback((raw: string) => formatTaxId(raw, kind), [kind]);

  const inputProps = useFormattedInput({
    value,
    onChange,
    format,
  });

  const incomplete = value.length > 0 && !isCompleteTaxId(value, kind);
  const validationError = incomplete ? `${kind} incompleto.` : undefined;

  return (
    <Input
      {...props}
      {...inputProps}
      inputMode="numeric"
      autoComplete="off"
      placeholder={props.placeholder ?? taxIdPlaceholder(kind)}
      error={error ?? validationError}
    />
  );
}
