import { useCallback } from 'react';
import {
  formatWhatsappInput,
  isCompleteWhatsapp,
  WHATSAPP_PLACEHOLDER,
} from '@/lib/identifiers';
import { Input, type InputProps } from './Input';

export interface WhatsappInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Quando true, não exibe erro de incompleto enquanto o usuário digita. */
  optional?: boolean;
}

export function WhatsappInput({ value, onChange, error, optional = false, ...props }: WhatsappInputProps) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(formatWhatsappInput(value, event.target.value));
    },
    [onChange, value],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      onChange(formatWhatsappInput(value, event.clipboardData.getData('text')));
    },
    [onChange, value],
  );

  const incomplete = !optional && value.length > 0 && !isCompleteWhatsapp(value);
  const validationError = incomplete ? 'WhatsApp incompleto.' : undefined;

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? WHATSAPP_PLACEHOLDER}
      error={error ?? validationError}
    />
  );
}
