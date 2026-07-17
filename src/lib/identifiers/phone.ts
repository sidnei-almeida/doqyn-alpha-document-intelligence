import { extractDigits } from './digits';
import { BR_COUNTRY_CODE, WHATSAPP_MAX_DIGITS, formatBrazilianPhone } from './whatsapp';
import { defaultCountryForLocale, type CountryCode } from './countryIdentifiers';
import type { SupportedLocale } from '@/i18n/config';

export type PhoneCountrySpec = {
  dialCode: string;
  placeholder: string;
  nationalLengths: number[];
  format(nationalDigits: string): string;
};

const PY_DIAL_CODE = '595';
const US_DIAL_CODE = '1';

/** Formata número paraguaio: +595 981 234 567 (grupos parciais de 3 dígitos durante a digitação). */
function formatParaguayanPhone(national: string): string {
  if (!national) return `+${PY_DIAL_CODE}`;
  const groups = national.match(/.{1,3}/g) ?? [];
  return `+${PY_DIAL_CODE} ${groups.join(' ')}`;
}

/** Formata número americano: +1 (202) 555-0123 (degrada graciosamente com input parcial). */
function formatAmericanPhone(national: string): string {
  if (!national) return `+${US_DIAL_CODE}`;

  const area = national.slice(0, 3);
  if (national.length <= 3) {
    return `+${US_DIAL_CODE} (${area}`;
  }

  const rest = national.slice(3);
  const prefix = rest.slice(0, 3);
  const line = rest.slice(3, 7);

  if (!line) {
    return `+${US_DIAL_CODE} (${area}) ${prefix}`;
  }

  return `+${US_DIAL_CODE} (${area}) ${prefix}-${line}`;
}

export const PHONE_COUNTRIES: Record<CountryCode, PhoneCountrySpec> = {
  BR: {
    dialCode: BR_COUNTRY_CODE,
    placeholder: '+55 54 99999-9999',
    nationalLengths: [10, 11],
    format: (national) => formatBrazilianPhone(`${BR_COUNTRY_CODE}${national}`),
  },
  PY: {
    dialCode: PY_DIAL_CODE,
    placeholder: '+595 981 234 567',
    nationalLengths: [9],
    format: formatParaguayanPhone,
  },
  US: {
    dialCode: US_DIAL_CODE,
    placeholder: '+1 (202) 555-0123',
    nationalLengths: [10],
    format: formatAmericanPhone,
  },
};

/** Extrai os dígitos nacionais removendo o dial code do país quando presente. */
function nationalDigitsFor(rawInput: string, country: CountryCode): string {
  const spec = PHONE_COUNTRIES[country];
  const digits = extractDigits(rawInput, WHATSAPP_MAX_DIGITS);
  return digits.startsWith(spec.dialCode) ? digits.slice(spec.dialCode.length) : digits;
}

/** E.164 sem o "+": dial code do país + dígitos nacionais. */
export function toE164(rawInput: string, country: CountryCode): string {
  if (!rawInput) return '';
  const spec = PHONE_COUNTRIES[country];
  const digits = extractDigits(rawInput, WHATSAPP_MAX_DIGITS);
  if (!digits) return '';
  if (digits.startsWith(spec.dialCode)) return digits;
  return `${spec.dialCode}${digits}`;
}

/** E.164 com o "+" prefixado. */
export function toE164Plus(rawInput: string, country: CountryCode): string {
  const e164 = toE164(rawInput, country);
  return e164 ? `+${e164}` : '';
}

/** Formata o telefone completo (com máscara) para o país informado. */
export function formatPhone(rawInput: string, country: CountryCode): string {
  if (!rawInput) return '';
  const spec = PHONE_COUNTRIES[country];
  const national = nationalDigitsFor(rawInput, country);
  return spec.format(national);
}

/** Verifica se a quantidade de dígitos nacionais bate com o esperado para o país. */
export function isCompletePhone(value: string, country: CountryCode): boolean {
  const spec = PHONE_COUNTRIES[country];
  const national = nationalDigitsFor(value, country);
  return spec.nationalLengths.includes(national.length);
}

/** País de telefone padrão a partir do locale ativo. */
export function defaultPhoneCountry(locale: SupportedLocale): CountryCode {
  return defaultCountryForLocale(locale);
}
