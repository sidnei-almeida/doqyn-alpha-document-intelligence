import { AsYouType, isValidPhoneNumber, getCountryCallingCode } from 'libphonenumber-js/min';
import { extractDigits } from './digits';
import { WHATSAPP_MAX_DIGITS } from './whatsapp';
import { defaultCountryForLocale, type CountryCode } from './countryIdentifiers';
import type { SupportedLocale } from '@/i18n/config';

export type PhoneCountrySpec = {
  placeholder: string;
};

/**
 * Placeholders de exibição pros países mais comuns. A formatação/validação em si vem de
 * libphonenumber-js (cobre qualquer país ISO) — um país sem entrada aqui cai no fallback
 * genérico de getPhonePlaceholder (só "+DDI "), não precisa de placeholder próprio.
 */
export const PHONE_COUNTRIES: Partial<Record<CountryCode, PhoneCountrySpec>> = {
  BR: { placeholder: '+55 54 99999 9999' },
  PY: { placeholder: '+595 981 234567' },
  US: { placeholder: '+1 202 555 0123' },
  ES: { placeholder: '+34 612 34 56 78' },
};

/** Placeholder de exibição do país; cai pra "+DDI " genérico se não houver um específico. */
export function getPhonePlaceholder(country: CountryCode): string {
  return PHONE_COUNTRIES[country]?.placeholder ?? `+${getCountryCallingCode(country)} `;
}

/** Extrai os dígitos nacionais removendo o DDI do país quando presente. */
function nationalDigitsFor(rawInput: string, country: CountryCode): string {
  const dial = getCountryCallingCode(country);
  const digits = extractDigits(rawInput, WHATSAPP_MAX_DIGITS);
  return digits.startsWith(dial) ? digits.slice(dial.length) : digits;
}

/** E.164 sem o "+": DDI do país + dígitos nacionais. */
export function toE164(rawInput: string, country: CountryCode): string {
  if (!rawInput) return '';
  const national = nationalDigitsFor(rawInput, country);
  if (!national) return '';
  return `${getCountryCallingCode(country)}${national}`;
}

/** E.164 com o "+" prefixado. */
export function toE164Plus(rawInput: string, country: CountryCode): string {
  const e164 = toE164(rawInput, country);
  return e164 ? `+${e164}` : '';
}

/** Formata o telefone completo (com máscara) para o país informado, digitando progressivamente. */
export function formatPhone(rawInput: string, country: CountryCode): string {
  if (!rawInput) return '';
  const dial = getCountryCallingCode(country);
  const national = nationalDigitsFor(rawInput, country);
  if (!national) return `+${dial}`;
  return new AsYouType(country).input(`+${dial}${national}`);
}

/** Valida o número (dígito verificador de tamanho por tipo de linha real, via libphonenumber-js). */
export function isCompletePhone(value: string, country: CountryCode): boolean {
  const e164Plus = toE164Plus(value, country);
  return e164Plus ? isValidPhoneNumber(e164Plus) : false;
}

/** País de telefone padrão a partir do locale ativo. */
export function defaultPhoneCountry(locale: SupportedLocale): CountryCode {
  return defaultCountryForLocale(locale);
}
