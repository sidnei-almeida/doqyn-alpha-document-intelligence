import { extractDigits } from './digits';
import {
  formatCnpj,
  formatCpf,
  taxIdPlaceholder,
  validateCnpj,
  validateCpf,
} from './taxId';
import type { SupportedLocale } from '@/i18n/config';

export type CountryCode = 'BR' | 'PY' | 'US';

export type PersonType = 'individual' | 'company';

export type IdentifierSpec = {
  code: string;
  labelKey: string;
  format(raw: string): string;
  placeholder: string;
  normalize(raw: string): string;
  isComplete(raw: string): boolean;
  validate(raw: string): boolean;
  inputMode: 'numeric' | 'text';
};

const CI_MAX_LENGTH = 9;
const CI_MIN_LENGTH = 6;
const RUC_BASE_LENGTH = 8;
const RUC_LENGTH = RUC_BASE_LENGTH + 1;
const SSN_LENGTH = 9;
const EIN_LENGTH = 9;

/** Agrupa dígitos em blocos de milhar da direita para a esquerda (ex.: 1234567 -> 1.234.567). */
function formatThousands(digits: string): string {
  if (digits.length <= 3) return digits;

  const chunks: string[] = [];
  let remaining = digits;
  while (remaining.length > 3) {
    chunks.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  chunks.unshift(remaining);
  return chunks.join('.');
}

/**
 * Recalcula o dígito verificador do RUC paraguaio (mód. 11, base 11): pondera os
 * dígitos da base da direita para a esquerda com peso iniciando em 2 e incrementando
 * a cada dígito, reiniciando o peso para 2 sempre que ultrapassar 11.
 */
function computeRucCheckDigit(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    sum += Number(base[i]) * weight;
    weight += 1;
    if (weight > 11) weight = 2;
  }
  const resto = sum % 11;
  return resto > 1 ? 11 - resto : 0;
}

function formatRuc(raw: string): string {
  const digits = extractDigits(raw, RUC_LENGTH);
  if (digits.length <= RUC_BASE_LENGTH) return digits;
  return `${digits.slice(0, RUC_BASE_LENGTH)}-${digits.slice(RUC_BASE_LENGTH, RUC_LENGTH)}`;
}

function validateRuc(raw: string): boolean {
  const digits = extractDigits(raw, RUC_LENGTH);
  if (digits.length !== RUC_LENGTH) return false;
  const expectedDv = computeRucCheckDigit(digits.slice(0, RUC_BASE_LENGTH));
  return expectedDv === Number(digits[RUC_BASE_LENGTH]);
}

function formatSsn(raw: string): string {
  const digits = extractDigits(raw, SSN_LENGTH);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function validateSsn(raw: string): boolean {
  const digits = extractDigits(raw, SSN_LENGTH);
  if (digits.length !== SSN_LENGTH) return false;

  const area = digits.slice(0, 3);
  const group = digits.slice(3, 5);
  const serial = digits.slice(5, 9);

  if (area === '000' || area === '666' || Number(area) >= 900) return false;
  if (group === '00') return false;
  if (serial === '0000') return false;
  return true;
}

function formatEin(raw: string): string {
  const digits = extractDigits(raw, EIN_LENGTH);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function validateEin(raw: string): boolean {
  return extractDigits(raw, EIN_LENGTH).length === EIN_LENGTH;
}

export const COUNTRY_IDENTIFIERS: Record<CountryCode, Record<PersonType, IdentifierSpec>> = {
  BR: {
    individual: {
      code: 'CPF',
      labelKey: 'identifiers:doc.cpf',
      format: formatCpf,
      placeholder: taxIdPlaceholder('CPF'),
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length === 11,
      validate: validateCpf,
      inputMode: 'numeric',
    },
    company: {
      code: 'CNPJ',
      labelKey: 'identifiers:doc.cnpj',
      format: formatCnpj,
      placeholder: taxIdPlaceholder('CNPJ'),
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length === 14,
      validate: validateCnpj,
      inputMode: 'numeric',
    },
  },
  PY: {
    individual: {
      code: 'CI',
      labelKey: 'identifiers:doc.ci',
      format: (raw) => formatThousands(extractDigits(raw, CI_MAX_LENGTH)),
      placeholder: '1.234.567',
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length >= CI_MIN_LENGTH,
      validate: (raw) => {
        const length = extractDigits(raw).length;
        return length >= CI_MIN_LENGTH && length <= CI_MAX_LENGTH;
      },
      inputMode: 'numeric',
    },
    company: {
      code: 'RUC',
      labelKey: 'identifiers:doc.ruc',
      format: formatRuc,
      placeholder: '80012345-6',
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length === RUC_LENGTH,
      validate: validateRuc,
      inputMode: 'numeric',
    },
  },
  US: {
    individual: {
      code: 'SSN',
      labelKey: 'identifiers:doc.ssn',
      format: formatSsn,
      placeholder: '123-45-6789',
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length === SSN_LENGTH,
      validate: validateSsn,
      inputMode: 'numeric',
    },
    company: {
      code: 'EIN',
      labelKey: 'identifiers:doc.ein',
      format: formatEin,
      placeholder: '12-3456789',
      normalize: (raw) => extractDigits(raw),
      isComplete: (raw) => extractDigits(raw).length === EIN_LENGTH,
      validate: validateEin,
      inputMode: 'numeric',
    },
  },
};

export function getIdentifierSpec(country: CountryCode, personType: PersonType): IdentifierSpec {
  return COUNTRY_IDENTIFIERS[country][personType];
}

export const SUPPORTED_COUNTRIES: CountryCode[] = ['BR', 'PY', 'US'];

export function countryLabelKey(country: CountryCode): string {
  return `identifiers:country.${country}`;
}

const LOCALE_TO_COUNTRY: Record<SupportedLocale, CountryCode> = {
  'pt-BR': 'BR',
  'es-PY': 'PY',
  'en-US': 'US',
};

export function defaultCountryForLocale(locale: SupportedLocale): CountryCode {
  return LOCALE_TO_COUNTRY[locale] ?? 'BR';
}
