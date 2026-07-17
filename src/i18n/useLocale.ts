/**
 * Reactive access to the active locale plus a live-switch + persist action
 * (SEL-03). Decoupled from the `i18next` singleton import — obtains the
 * instance via `useTranslation()`, matching `useDocumentLang`.
 *
 * `setLocale` both changes the active i18next language immediately (no
 * reload — `useDocumentLang` keeps `<html lang>` in sync via the
 * `languageChanged` listener) and persists the choice so the next session
 * restores it (SEL-02).
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES } from './config';
import type { SupportedLocale } from './config';
import { setStoredLocale } from './localePreference';

export type UseLocaleResult = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  supportedLocales: typeof SUPPORTED_LOCALES;
};

export function useLocale(): UseLocaleResult {
  const { i18n } = useTranslation();

  const setLocale = useCallback(
    (locale: SupportedLocale) => {
      void i18n.changeLanguage(locale);
      setStoredLocale(locale);
    },
    [i18n],
  );

  return {
    locale: i18n.language as SupportedLocale,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
  };
}
