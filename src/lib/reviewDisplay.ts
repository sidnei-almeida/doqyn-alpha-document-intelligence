import {
  formatCnpj,
  formatTaxId,
  normalizeCnpj,
  normalizeTaxId,
  type TaxIdKind,
} from './identifiers/taxId';
import { formatWhatsapp } from './identifiers/whatsapp';

/**
 * Chave, não frase: este módulo é importado no topo de três telas de cadastro, e resolver aqui
 * congelaria o idioma no carregamento. Quem monta a revisão resolve com o `t` da tela.
 */
export const PASSWORD_REVIEW_LABEL_KEY = 'auth:review.value.passwordDefined';

export function safeDisplayValue(value: string | undefined | null): string {
  return value?.trim() ? value.trim() : '—';
}

export function formatDocument(value: string, kind: TaxIdKind = 'CNPJ'): string {
  const normalized = kind === 'CNPJ' ? normalizeCnpj(value) : normalizeTaxId(value);
  if (!normalized) return '—';
  return formatTaxId(normalized, kind);
}

/** CPF parcialmente mascarado para revisão; CNPJ formatado por completo. */
export function formatDocumentForReview(value: string, kind: TaxIdKind): string {
  if (kind === 'CNPJ') {
    const cnpj = normalizeCnpj(value);
    return cnpj ? formatCnpj(cnpj) : '—';
  }

  const digits = normalizeTaxId(value);
  if (!digits) return '—';

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
