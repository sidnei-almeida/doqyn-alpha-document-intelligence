import { createHash } from 'node:crypto';

export type TaxIdType = 'CPF' | 'CNPJ';

export function normalizeTaxId(value: string): string {
  return value.replace(/\D/g, '');
}

export function hashTaxId(value: string): string {
  const normalized = normalizeTaxId(value);
  return createHash('sha256').update(normalized).digest('hex');
}

export function maskTaxId(value: string, type: TaxIdType): string {
  const digits = normalizeTaxId(value);

  if (type === 'CPF') {
    if (digits.length < 3) return '***.***.***-**';
    const tail = digits.slice(-2);
    return `***.***.***-${tail.padStart(2, '*')}`;
  }

  if (digits.length < 4) return '**.***.***/****-**';
  const branch = digits.slice(-6, -2) || '****';
  const tail = digits.slice(-2);
  return `**.***.${branch}/****-${tail.padStart(2, '*')}`;
}

export function detectTaxIdType(value: string): TaxIdType {
  const digits = normalizeTaxId(value);
  return digits.length > 11 ? 'CNPJ' : 'CPF';
}

export function validateTaxId(value: string, expectedType: TaxIdType): boolean {
  const digits = normalizeTaxId(value);
  if (expectedType === 'CPF') return digits.length === 11;
  return digits.length === 14;
}

export const SHARED_INDIVIDUAL_COLLECTION_PREFIX = 'compartilhado';

/** @deprecated Use SHARED_INDIVIDUAL_COLLECTION_PREFIX */
export const LEGACY_INDIVIDUAL_POOL_PREFIX = 'individual_pool';

export function buildIndividualPoolPrefix(): string {
  return SHARED_INDIVIDUAL_COLLECTION_PREFIX;
}

export function buildBusinessCollectionPrefix(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
}
