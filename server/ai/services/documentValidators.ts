import type { DocumentRuleField, FieldType } from '../types/documentAi.types.js';

export function validateCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11;
}

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 14;
}

export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeDate(value: string): string | null {
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const brDash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (brDash) return `${brDash[3]}-${brDash[2]}-${brDash[1]}`;

  return null;
}

export function normalizeCurrency(value: string | number): {
  amount: number | null;
  currency: string;
} {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: value, currency: 'BRL' };
  }

  const raw = String(value).trim();
  const cleaned = raw
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const amount = Number.parseFloat(cleaned);
  if (!Number.isFinite(amount)) {
    return { amount: null, currency: 'BRL' };
  }

  return { amount, currency: 'BRL' };
}

export function normalizeExtractedValue(
  value: string | number | null,
  fieldType: FieldType,
): string | number | null {
  if (value === null || value === '') return null;

  if (fieldType === 'date' && typeof value === 'string') {
    return normalizeDate(value);
  }

  if (fieldType === 'currency') {
    const { amount } = normalizeCurrency(value);
    return amount;
  }

  if (fieldType === 'number') {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (fieldType === 'string' && typeof value === 'string') {
    return value.trim() || null;
  }

  return value;
}

export function normalizeStringFieldValue(
  value: string | number | null,
  field: DocumentRuleField,
): string | number | null {
  if (value === null || value === '') return null;

  if (field.key.includes('cnpj') || field.key.includes('cpf')) {
    if (typeof value === 'string') {
      if (validateCnpj(value)) return normalizeCnpj(value);
      if (validateCpf(value)) return normalizeCpf(value);
      return value.trim();
    }
  }

  return normalizeExtractedValue(value, field.type);
}