/**
 * Locale persistence (SEL-02) + pure initial-locale precedence resolver.
 *
 * Mirrors the localStorage try/catch pattern used by
 * `src/features/library/utils/libraryDefaultView.ts`: reads/writes never
 * throw, and an invalid or inaccessible stored value simply falls back to
 * browser-language detection rather than crashing app init.
 */
import { SUPPORTED_LOCALES } from './config';
import type { SupportedLocale } from './config';
import { resolveSupportedLocale } from './config';

export const LOCALE_STORAGE_KEY = 'doqyn.locale';

function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getStoredLocale(): SupportedLocale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

/**
 * Pure/DOM-free precedence rule (D-02): a valid stored preference always
 * wins over browser auto-detection. No localStorage/navigator access here —
 * callers pass in the already-read stored value and detected language list.
 */
export function resolveInitialLocale(
  storedRaw: string | null | undefined,
  languages: readonly string[],
): SupportedLocale {
  if (isSupportedLocale(storedRaw)) {
    return storedRaw;
  }

  return resolveSupportedLocale(languages);
}
