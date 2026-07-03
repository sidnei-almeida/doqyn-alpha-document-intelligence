import { extractDigits } from './digits';

/** E.164 permite até 15 dígitos (sem o +). */
export const WHATSAPP_MAX_DIGITS = 15;
export const WHATSAPP_MIN_DIGITS = 10;
export const BR_COUNTRY_CODE = '55';

export function normalizeWhatsapp(value: string): string {
  return extractDigits(value, WHATSAPP_MAX_DIGITS);
}

/**
 * Garante DDI brasileiro quando o usuário informa só DDD+número (10–11 dígitos).
 * Não altera números internacionais já com outro DDI.
 */
export function ensureBrCountryCode(digits: string): string {
  const d = extractDigits(digits, WHATSAPP_MAX_DIGITS);
  if (!d) return d;

  if (d.startsWith(BR_COUNTRY_CODE) && d.length >= 12) {
    return d;
  }

  if (d.length >= 10 && d.length <= 11) {
    return `${BR_COUNTRY_CODE}${d}`;
  }

  return d;
}

/** Formata para exibição enquanto o usuário digita ou cola. */
export function formatWhatsapp(value: string): string {
  const digits = ensureBrCountryCode(normalizeWhatsapp(value));
  if (!digits) return '';

  if (!digits.startsWith(BR_COUNTRY_CODE)) {
    return digits.length <= 4 ? `+${digits}` : `+${digits.slice(0, 4)} ${digits.slice(4)}`;
  }

  const country = BR_COUNTRY_CODE;
  const national = digits.slice(2);
  if (!national) return `+${country}`;
  if (national.length <= 2) return `+${country} (${national}`;

  const ddd = national.slice(0, 2);
  const number = national.slice(2);
  if (!number) return `+${country} (${ddd})`;

  if (number.length <= 4) {
    return `+${country} (${ddd}) ${number}`;
  }

  if (number.length <= 8) {
    return `+${country} (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  return `+${country} (${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
}

export function isCompleteWhatsapp(value: string): boolean {
  const digits = toWhatsappApiValue(value);
  return digits.length >= WHATSAPP_MIN_DIGITS && digits.length <= WHATSAPP_MAX_DIGITS;
}

/**
 * Formato para APIs de WhatsApp (E.164 sem +): ex. 5511999998888
 * Alinhado com server/utils/contactNormalize.ts
 */
export function toWhatsappApiValue(value: string): string {
  return ensureBrCountryCode(normalizeWhatsapp(value));
}

export const WHATSAPP_PLACEHOLDER = '+55 (11) 99999-9999';
