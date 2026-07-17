import { extractDigits } from './digits';

export type TaxIdKind = 'CPF' | 'CNPJ';

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

export function normalizeTaxId(value: string): string {
  return extractDigits(value);
}

export function formatCpf(digits: string): string {
  const d = extractDigits(digits, CPF_LENGTH);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(digits: string): string {
  const d = extractDigits(digits, CNPJ_LENGTH);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatTaxId(value: string, kind: TaxIdKind): string {
  const digits = normalizeTaxId(value);
  return kind === 'CPF' ? formatCpf(digits) : formatCnpj(digits);
}

export function isCompleteTaxId(value: string, kind: TaxIdKind): boolean {
  const digits = normalizeTaxId(value);
  return kind === 'CPF' ? digits.length === CPF_LENGTH : digits.length === CNPJ_LENGTH;
}

export function taxIdPlaceholder(kind: TaxIdKind): string {
  return kind === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00';
}

/** Valor enviado à API — apenas dígitos (backend aceita com ou sem máscara). */
export function toTaxIdApiValue(value: string): string {
  return normalizeTaxId(value);
}

function isAllSameDigit(digits: string): boolean {
  return digits.length > 0 && digits.split('').every((d) => d === digits[0]);
}

function computeModulo11CheckDigit(digits: string, weights: number[]): number {
  const sum = digits
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
  const resto = sum % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida os dígitos verificadores do CPF (mód. 11), adicional ao gate de completude por comprimento. */
export function validateCpf(value: string): boolean {
  const digits = extractDigits(value);
  if (digits.length !== CPF_LENGTH) return false;
  if (isAllSameDigit(digits)) return false;

  const dv1 = computeModulo11CheckDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (dv1 !== Number(digits[9])) return false;

  const dv2 = computeModulo11CheckDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv2 === Number(digits[10]);
}

/** Valida os dígitos verificadores do CNPJ (mód. 11), adicional ao gate de completude por comprimento. */
export function validateCnpj(value: string): boolean {
  const digits = extractDigits(value);
  if (digits.length !== CNPJ_LENGTH) return false;
  if (isAllSameDigit(digits)) return false;

  const dv1 = computeModulo11CheckDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  if (dv1 !== Number(digits[12])) return false;

  const dv2 = computeModulo11CheckDigit(
    digits.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return dv2 === Number(digits[13]);
}
