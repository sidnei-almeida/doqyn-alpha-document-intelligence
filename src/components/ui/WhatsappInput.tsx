import { useCallback } from 'react';
import {
  formatPhoneForCountry,
  formatWhatsappInput,
  isCompletePhoneForCountry,
  isCompleteWhatsapp,
  phonePlaceholder,
  WHATSAPP_PLACEHOLDER,
  type CountryCode,
} from '@/lib/identifiers';
import { Input, type InputProps } from './Input';

export interface WhatsappInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Quando true, não exibe erro de incompleto enquanto o usuário digita. */
  optional?: boolean;
  /**
   * País do número. Quando informado, máscara e validação seguem esse país; quando ausente,
   * vale o comportamento brasileiro histórico — telas sem seletor de país (convite,
   * compartilhamento, assinatura) continuam iguais.
   */
  country?: CountryCode;
}

export function WhatsappInput({
  value,
  onChange,
  error,
  optional = false,
  country,
  ...props
}: WhatsappInputProps) {
  const format = useCallback(
    (previous: string, raw: string) =>
      country ? formatPhoneForCountry(country, raw) : formatWhatsappInput(previous, raw),
    [country],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(format(value, event.target.value));
    },
    [format, onChange, value],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      onChange(format(value, event.clipboardData.getData('text')));
    },
    [format, onChange, value],
  );

  const complete = country ? isCompletePhoneForCountry(country, value) : isCompleteWhatsapp(value);
  const incomplete = !optional && value.length > 0 && !complete;
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
      placeholder={
        props.placeholder ?? (country ? phonePlaceholder(country) : WHATSAPP_PLACEHOLDER)
      }
      error={error ?? validationError}
    />
  );
}
