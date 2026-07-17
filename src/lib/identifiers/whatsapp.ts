import { extractDigits } from './digits';

/** E.164 permite até 15 dígitos (sem o +). */
export const WHATSAPP_MAX_DIGITS = 15;
export const WHATSAPP_MIN_DIGITS = 10;
export const BR_COUNTRY_CODE = '55';
/** 55 + DDD (2) + celular (9) */
export const BR_PHONE_MAX_DIGITS = 13;

export function normalizeWhatsapp(value: string): string {
  return extractDigits(value, WHATSAPP_MAX_DIGITS);
}

export function hasExplicitInternationalPrefix(value: string): boolean {
  return value.trimStart().startsWith('+');
}

/**
 * Garante DDI brasileiro quando o usuário informa só DDD+número (10–11 dígitos).
 * Não duplica +55 se o número já começa com 55.
 */
export function ensureBrCountryCode(digits: string): string {
  const d = extractDigits(digits, WHATSAPP_MAX_DIGITS);
  if (!d) return d;

  if (d.startsWith(BR_COUNTRY_CODE)) {
    return d;
  }

  if (d.length >= 10 && d.length <= 11) {
    return `${BR_COUNTRY_CODE}${d}`;
  }

  return d;
}

type FormatDigitsOptions = {
  explicitInternational: boolean;
};

function resolveDigits(digits: string, options: FormatDigitsOptions): string {
  if (options.explicitInternational) {
    return digits;
  }
  return ensureBrCountryCode(digits);
}

/** Formata número brasileiro: +55 54 99999-9999 */
export function formatBrazilianPhone(digits: string): string {
  const bounded = digits.slice(0, BR_PHONE_MAX_DIGITS);
  const national = bounded.slice(BR_COUNTRY_CODE.length);
  if (!national) return `+${BR_COUNTRY_CODE}`;

  const ddd = national.slice(0, 2);
  const number = national.slice(2, 11);

  if (national.length <= 2) {
    return `+${BR_COUNTRY_CODE} ${ddd}`;
  }

  if (!number) {
    return `+${BR_COUNTRY_CODE} ${ddd}`;
  }

  if (number.length <= 4) {
    return `+${BR_COUNTRY_CODE} ${ddd} ${number}`;
  }

  if (number.length <= 8) {
    return `+${BR_COUNTRY_CODE} ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  return `+${BR_COUNTRY_CODE} ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
}

/** Formata outros países sem assumir DDI brasileiro. */
function formatInternationalPhone(digits: string): string {
  if (!digits) return '+';

  if (digits.startsWith('1')) {
    const national = digits.slice(1);
    if (!national) return '+1';
    if (national.length <= 3) return `+1 ${national}`;
    if (national.length <= 6) return `+1 ${national.slice(0, 3)} ${national.slice(3)}`;
    return `+1 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 10)}`;
  }

  if (digits.length <= 3) return `+${digits}`;

  const countryLength = digits.length > 11 ? 3 : 2;
  const country = digits.slice(0, countryLength);
  const rest = digits.slice(countryLength);
  if (!rest) return `+${country}`;

  const groups = rest.match(/.{1,3}/g) ?? [];
  return `+${country} ${groups.join(' ')}`.trim();
}

function formatDigits(digits: string, options: FormatDigitsOptions): string {
  if (!digits) {
    return options.explicitInternational ? '+' : '';
  }

  const resolved = resolveDigits(digits, options);

  if (resolved.startsWith(BR_COUNTRY_CODE)) {
    return formatBrazilianPhone(resolved);
  }

  return formatInternationalPhone(resolved.slice(0, WHATSAPP_MAX_DIGITS));
}

/**
 * Formata a partir do valor bruto do input (colagem ou estado inicial).
 */
export function formatWhatsapp(value: string): string {
  return formatDigits(normalizeWhatsapp(value), {
    explicitInternational: hasExplicitInternationalPrefix(value),
  });
}

/**
 * Formata enquanto o usuário digita/apaga, usando apenas a sequência de dígitos
 * extraída do input — evita corrupção ao remover hífens/espaços.
 */
export function formatWhatsappInput(previousFormatted: string, inputRaw: string): string {
  const explicitInternational =
    hasExplicitInternationalPrefix(inputRaw) || hasExplicitInternationalPrefix(previousFormatted);

  if (!normalizeWhatsapp(inputRaw)) {
    return explicitInternational ? '+' : '';
  }

  return formatDigits(normalizeWhatsapp(inputRaw), { explicitInternational });
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
  const digits = normalizeWhatsapp(value);
  if (!digits) return '';

  if (hasExplicitInternationalPrefix(value)) {
    return digits;
  }

  return ensureBrCountryCode(digits);
}

export const WHATSAPP_PLACEHOLDER = '+55 54 99999-9999';
