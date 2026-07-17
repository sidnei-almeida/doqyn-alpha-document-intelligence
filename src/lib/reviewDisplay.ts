import type { TaxIdKind } from './identifiers/taxId';
import { formatWhatsapp } from './identifiers/whatsapp';
import {
  getIdentifierSpec,
  type CountryCode,
  type PersonType,
} from './identifiers/countryIdentifiers';

export const PASSWORD_REVIEW_LABEL = 'Senha definida — não exibida por segurança';

export function safeDisplayValue(value: string | undefined | null): string {
  return value?.trim() ? value.trim() : '—';
}

/**
 * Resolve o par (country, personType) a partir da forma legada BR-only
 * (`TaxIdKind`) ou da forma genérica (`CountryCode` + `PersonType`), mantendo
 * compatibilidade com os chamadores atuais (individual/company/access-request
 * signup review) que só conhecem 'CPF'|'CNPJ'.
 */
function resolveCountryPersonType(
  kindOrCountry: TaxIdKind | CountryCode,
  personType?: PersonType,
): { country: CountryCode; personType: PersonType } {
  if (kindOrCountry === 'CPF') return { country: 'BR', personType: 'individual' };
  if (kindOrCountry === 'CNPJ') return { country: 'BR', personType: 'company' };
  return { country: kindOrCountry, personType: personType as PersonType };
}

/** Mascara mantendo apenas os últimos `visible` dígitos, agrupando em blocos de milhar. */
function maskKeepingLastDigits(digits: string, visible: number): string {
  const masked = '*'.repeat(Math.max(digits.length - visible, 0)) + digits.slice(-visible);
  return groupThousands(masked);
}

/** Agrupa caracteres em blocos de 3 da direita para a esquerda (ex.: ****567 -> *.***.567). */
function groupThousands(chars: string): string {
  if (chars.length <= 3) return chars;

  const chunks: string[] = [];
  let remaining = chars;
  while (remaining.length > 3) {
    chunks.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  chunks.unshift(remaining);
  return chunks.join('.');
}

export function formatDocument(value: string, kind?: TaxIdKind): string;
export function formatDocument(value: string, country: CountryCode, personType: PersonType): string;
export function formatDocument(
  value: string,
  kindOrCountry: TaxIdKind | CountryCode = 'CNPJ',
  personType?: PersonType,
): string {
  const resolved = resolveCountryPersonType(kindOrCountry, personType);
  const spec = getIdentifierSpec(resolved.country, resolved.personType);
  const digits = spec.normalize(value);
  if (!digits) return '—';
  return spec.format(digits);
}

/**
 * Documento pessoal (CPF/SSN/CI) parcialmente mascarado para revisão;
 * documento de empresa (CNPJ/EIN/RUC) formatado por completo.
 */
export function formatDocumentForReview(value: string, kind: TaxIdKind): string;
export function formatDocumentForReview(
  value: string,
  country: CountryCode,
  personType: PersonType,
): string;
export function formatDocumentForReview(
  value: string,
  kindOrCountry: TaxIdKind | CountryCode,
  personType?: PersonType,
): string {
  const resolved = resolveCountryPersonType(kindOrCountry, personType);
  const spec = getIdentifierSpec(resolved.country, resolved.personType);
  const digits = spec.normalize(value);
  if (!digits) return '—';

  if (resolved.personType === 'company') {
    return spec.format(digits);
  }

  switch (resolved.country) {
    case 'BR':
      if (digits.length < 11) return spec.format(digits);
      return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
    case 'US':
      if (digits.length < 9) return spec.format(digits);
      return `***-**-${digits.slice(-4)}`;
    case 'PY':
      if (digits.length < 4) return spec.format(digits);
      return maskKeepingLastDigits(digits, 3);
    default:
      return spec.format(digits);
  }
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
