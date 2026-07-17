import i18n from '@/i18n';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import type { SupportedLocale } from '@/i18n/config';

/**
 * Returns the active i18n locale, validated against SUPPORTED_LOCALES.
 * Falls back to DEFAULT_LOCALE for any unexpected/unsupported value
 * (T-03-01: i18n.language is not trusted as a SupportedLocale by construction).
 */
export function getActiveLocale(): SupportedLocale {
  const current = i18n.language;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(current)) {
    return current as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  locale?: SupportedLocale,
): string {
  const l = locale ?? getActiveLocale();
  const d = toDate(value);
  return opts === undefined ? d.toLocaleDateString(l) : new Intl.DateTimeFormat(l, opts).format(d);
}

export function formatDateTime(
  value: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  locale?: SupportedLocale,
): string {
  const l = locale ?? getActiveLocale();
  const d = toDate(value);
  return opts === undefined ? d.toLocaleString(l) : new Intl.DateTimeFormat(l, opts).format(d);
}

export function formatTime(
  value: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  locale?: SupportedLocale,
): string {
  const l = locale ?? getActiveLocale();
  const d = toDate(value);
  return opts === undefined ? d.toLocaleTimeString(l) : new Intl.DateTimeFormat(l, opts).format(d);
}

export function formatNumber(
  value: number,
  opts?: Intl.NumberFormatOptions,
  locale?: SupportedLocale,
): string {
  return new Intl.NumberFormat(locale ?? getActiveLocale(), opts).format(value);
}

export function localeCompareActive(a: string, b: string, locale?: SupportedLocale): number {
  return a.localeCompare(b, locale ?? getActiveLocale());
}
