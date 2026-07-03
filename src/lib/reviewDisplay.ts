import {
  formatCnpj,
  formatTaxId,
  normalizeTaxId,
  type TaxIdKind,
} from './identifiers/taxId';
import { formatWhatsapp } from './identifiers/whatsapp';

export const PASSWORD_REVIEW_LABEL = 'Senha definida — não exibida por segurança';

export function safeDisplayValue(value: string | undefined | null): string {
  return value?.trim() ? value.trim() : '—';
}

export function formatDocument(value: string, kind: TaxIdKind = 'CNPJ'): string {
  const digits = normalizeTaxId(value);
  if (!digits) return '—';
  return formatTaxId(digits, kind);
}

/** CPF parcialmente mascarado para revisão; CNPJ formatado por completo. */
export function formatDocumentForReview(value: string, kind: TaxIdKind): string {
  const digits = normalizeTaxId(value);
  if (!digits) return '—';

  if (kind === 'CNPJ') {
    return formatCnpj(digits);
  }

  if (digits.length < 11) {
    return formatTaxId(digits, 'CPF');
  }

  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

export function formatPhone(value: string | undefined | null): string {
  if (!value?.trim()) return '—';
  const formatted = formatWhatsapp(value);
  return formatted || safeDisplayValue(value);
}

export function formatBooleanConsent(
  accepted: boolean,
  acceptedLabel: string,
  rejectedLabel: string,
): string {
  return accepted ? acceptedLabel : rejectedLabel;
}
