import { extractDigits } from './digits';

export type TaxIdKind = 'CPF' | 'CNPJ';

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

const CPF_WEIGHTS_FIRST = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_WEIGHTS_SECOND = [11, ...CPF_WEIGHTS_FIRST];
const CNPJ_WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_SECOND = [6, ...CNPJ_WEIGHTS_FIRST];

/** CPF é só dígito. Para CNPJ, ver `normalizeCnpj`. */
export function normalizeTaxId(value: string): string {
  return extractDigits(value);
}

/**
 * CNPJ alfanumérico da Receita (emitido desde julho de 2026): letra ou dígito nas 12 primeiras
 * posições, verificadores numéricos. Cortar letras aqui recusaria CNPJ novo legítimo.
 */
export function normalizeCnpj(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, CNPJ_LENGTH);
}

export function formatCpf(digits: string): string {
  const d = extractDigits(digits, CPF_LENGTH);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const d = normalizeCnpj(value);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatTaxId(value: string, kind: TaxIdKind): string {
  return kind === 'CPF' ? formatCpf(normalizeTaxId(value)) : formatCnpj(value);
}

export function isCompleteTaxId(value: string, kind: TaxIdKind): boolean {
  return kind === 'CPF'
    ? normalizeTaxId(value).length === CPF_LENGTH
    : normalizeCnpj(value).length === CNPJ_LENGTH;
}

/** Módulo 11 da Receita: resto menor que 2 vira 0, o resto vira 11 menos o resto. */
function checkDigit(values: number[], weights: number[]): number {
  const sum = weights.reduce((acc, weight, index) => acc + values[index] * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** `111.111.111-11` fecha a conta, mas não existe — a Receita não emite sequência repetida. */
function isRepeatedSequence(value: string): boolean {
  return /^(.)\1*$/.test(value);
}

/**
 * Mesma regra de `doqyn-auth-service/src/utils/taxIdValidation.ts`. O servidor é quem garante;
 * aqui é para avisar no campo antes de enviar.
 */
export function isValidCpf(value: string): boolean {
  const cpf = normalizeTaxId(value);
  if (cpf.length !== CPF_LENGTH || isRepeatedSequence(cpf)) return false;

  const digits = [...cpf].map(Number);
  return (
    digits[9] === checkDigit(digits, CPF_WEIGHTS_FIRST) &&
    digits[10] === checkDigit(digits, CPF_WEIGHTS_SECOND)
  );
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || isRepeatedSequence(cnpj)) return false;

  // No alfanumérico cada caractere vale o código ASCII menos 48: dígito vale ele mesmo, A vale 17.
  const values = [...cnpj].map((char) => char.charCodeAt(0) - 48);
  return (
    values[12] === checkDigit(values, CNPJ_WEIGHTS_FIRST) &&
    values[13] === checkDigit(values, CNPJ_WEIGHTS_SECOND)
  );
}

export function isValidTaxId(value: string, kind: TaxIdKind): boolean {
  return kind === 'CPF' ? isValidCpf(value) : isValidCnpj(value);
}

export function taxIdPlaceholder(kind: TaxIdKind): string {
  return kind === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00';
}

/** Valor enviado à API — apenas dígitos (backend aceita com ou sem máscara). */
export function toTaxIdApiValue(value: string): string {
  return normalizeTaxId(value);
}
