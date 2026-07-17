/**
 * Locale constants and the DOM-free browser-language detection mapping.
 *
 * This module is the single owner of the locked es/en/pt -> supported-locale
 * mapping (I18N-03). It must stay DOM-free and side-effect-free. Callers
 * (e.g. the i18next init in a later plan) pass in the language list to test.
 */

export const SUPPORTED_LOCALES = ['pt-BR', 'es-PY', 'en-US'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

const PRIMARY_SUBTAG_TO_LOCALE: Record<string, SupportedLocale> = {
  es: 'es-PY',
  en: 'en-US',
  pt: 'pt-BR',
};

/**
 * Resolves the first recognized language tag in `languages` to one of the
 * three supported locales, falling back to `DEFAULT_LOCALE` (pt-BR) when no
 * tag is recognized or the list is empty.
 */
export function resolveSupportedLocale(languages: readonly string[]): SupportedLocale {
  for (const language of languages) {
    if (!language) {
      continue;
    }

    const primarySubtag = language.split('-')[0]?.toLowerCase();
    const resolved = primarySubtag ? PRIMARY_SUBTAG_TO_LOCALE[primarySubtag] : undefined;

    if (resolved) {
      return resolved;
    }
  }

  return DEFAULT_LOCALE;
}
