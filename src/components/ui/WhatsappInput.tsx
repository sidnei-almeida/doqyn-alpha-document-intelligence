import { useCallback } from 'react';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import {
  formatWhatsapp,
  isCompleteWhatsapp,
  WHATSAPP_PLACEHOLDER,
} from '@/lib/identifiers';
import { Input, type InputProps } from './Input';

export interface WhatsappInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

export function WhatsappInput({ value, onChange, error, ...props }: WhatsappInputProps) {
  const format = useCallback((raw: string) => formatWhatsapp(raw), []);

  const inputProps = useFormattedInput({
    value,
    onChange,
    format,
  });

  const incomplete = value.length > 0 && !isCompleteWhatsapp(value);
  const validationError = incomplete ? 'WhatsApp incompleto.' : undefined;

  return (
    <Input
      {...props}
      {...inputProps}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? WHATSAPP_PLACEHOLDER}
      error={error ?? validationError}
    />
  );
}
