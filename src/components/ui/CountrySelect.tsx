import { useTranslation } from 'react-i18next';
import {
  countryLabelKey,
  SUPPORTED_COUNTRIES,
  type CountryCode,
} from '@/lib/identifiers/countryIdentifiers';
import { Select } from './Select';

export interface CountrySelectProps {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  label?: string;
  error?: string;
  id?: string;
}

export function CountrySelect({ value, onChange, label, error, id }: CountrySelectProps) {
  const { t } = useTranslation('identifiers');

  const options = SUPPORTED_COUNTRIES.map((code) => ({
    value: code,
    label: t(countryLabelKey(code)),
  }));

  return (
    <Select
      id={id}
      label={label}
      error={error}
      options={options}
      value={value}
      onChange={(event) => onChange(event.target.value as CountryCode)}
    />
  );
}
