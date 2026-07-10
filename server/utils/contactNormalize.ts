export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mantém apenas dígitos — esperado DDI+DDD+número quando informado. */
export function normalizeWhatsapp(value: string): string {
  return value.replace(/\D/g, '');
}

const BR_COUNTRY_CODE = '55';
const PHONE_MAX_DIGITS = 15;

export const INVALID_RECIPIENT_PHONE_MESSAGE =
  'Informe um telefone válido com DDI, por exemplo +55 54 99999-9999.';

const RECIPIENT_PHONE_INPUT_PATTERN = /^[\d+\s()-]+$/;

function ensureBrCountryCode(digits: string): string {
  const normalized = digits.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
  if (!normalized) return normalized;
  if (normalized.startsWith(BR_COUNTRY_CODE)) return normalized;
  if (normalized.length >= 10 && normalized.length <= 11) {
    return `${BR_COUNTRY_CODE}${normalized}`;
  }
  return normalized;
}

export type ParsedRecipientPhone = {
  recipientPhone: string;
  recipientPhoneNormalized: string;
  recipientPhoneCountryCode: string;
  recipientPhoneMasked: string;
};

/** Máscara para UI/logs — ex.: +55 54 *****-9999 */
export function maskRecipientPhoneForDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (!digits) return '****';
  const last4 = digits.slice(-4);

  if (digits.startsWith(BR_COUNTRY_CODE) && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    return `+${BR_COUNTRY_CODE} ${ddd} *****-${last4}`;
  }

  if (digits.length <= 4) return `*****-${last4}`;
  const prefixLen = Math.min(4, Math.max(2, digits.length - 7));
  return `+${digits.slice(0, prefixLen)} *****-${last4}`;
}

function extractRecipientPhoneCountryCode(digits: string): string {
  if (digits.startsWith(BR_COUNTRY_CODE) && digits.length >= 12) {
    return BR_COUNTRY_CODE;
  }
  if (digits.length >= 12) return digits.slice(0, 2);
  if (digits.length >= 11) return digits.slice(0, 1);
  return digits.slice(0, 2);
}

/**
 * Normaliza telefone opcional do convidado externo para E.164 (+...).
 * Sem DDI explícito, assume Brasil (+55) — validação internacional completa fica para depois.
 */
export function parseOptionalRecipientPhone(value?: string | null): ParsedRecipientPhone | null {
  if (!value?.trim()) return null;

  const recipientPhone = value.trim().replace(/\s+/g, ' ');
  if (!RECIPIENT_PHONE_INPUT_PATTERN.test(recipientPhone)) {
    throw new Error(INVALID_RECIPIENT_PHONE_MESSAGE);
  }

  const hasExplicitDdi = recipientPhone.startsWith('+');
  let digits = normalizeWhatsapp(recipientPhone);

  if (!hasExplicitDdi) {
    digits = ensureBrCountryCode(digits);
  }

  if (!isValidWhatsapp(digits)) {
    throw new Error(INVALID_RECIPIENT_PHONE_MESSAGE);
  }

  const recipientPhoneNormalized = `+${digits}`;
  const recipientPhoneCountryCode = extractRecipientPhoneCountryCode(digits);
  const recipientPhoneMasked = maskRecipientPhoneForDisplay(recipientPhoneNormalized);

  return {
    recipientPhone,
    recipientPhoneNormalized,
    recipientPhoneCountryCode,
    recipientPhoneMasked,
  };
}

export function maskWhatsappForLog(value: string): string {
  const digits = normalizeWhatsapp(value);
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes('@') && normalized.includes('.');
}

export function isValidWhatsapp(value: string): boolean {
  const digits = normalizeWhatsapp(value);
  return digits.length >= 10 && digits.length <= 15;
}
