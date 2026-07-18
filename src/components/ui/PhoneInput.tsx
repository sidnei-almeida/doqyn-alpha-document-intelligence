import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormattedInput } from '@/hooks/useFormattedInput';
import { formatPhone, getPhonePlaceholder, isCompletePhone } from '@/lib/identifiers/phone';
import type { CountryCode } from '@/lib/identifiers/countryIdentifiers';
import { CountrySelect } from './CountrySelect';
import { Input, type InputProps } from './Input';

export interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  /** Quando true, não exibe erro de incompleto enquanto o usuário digita. */
  optional?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  country,
  onCountryChange,
  error,
  optional = false,
  id,
  ...props
}: PhoneInputProps) {
  const { t } = useTranslation('identifiers');
  const format = useCallback((raw: string) => formatPhone(raw, country), [country]);

  const { onChange: handleChange, onPaste } = useFormattedInput({ value, onChange, format });

  const handleCountryChange = useCallback(
    (next: CountryCode) => {
      onCountryChange(next);
      // Reformatar o valor já digitado sob o DDI do país novo garantiria número
      // corrompido (os dígitos do DDI antigo virariam "nacionais" do país novo) —
      // mais seguro resetar, igual ao CountrySelect do documento fiscal.
      onChange('');
    },
    [onCountryChange, onChange],
  );

  const incomplete = !optional && value.length > 0 && !isCompletePhone(value, country);
  const validationError = incomplete
    ? t('incomplete', { doc: t('doc.phone') })
    : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
      <CountrySelect
        id={id ? `${id}-country` : undefined}
        label={t('ddiLabel')}
        value={country}
        onChange={handleCountryChange}
      />
      <Input
        {...props}
        id={id}
        value={value}
        onChange={handleChange}
        onPaste={onPaste}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={props.placeholder ?? getPhonePlaceholder(country)}
        error={error ?? validationError}
      />
    </div>
  );
}
