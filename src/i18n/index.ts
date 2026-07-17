/**
 * Configured i18next singleton for the app shell.
 *
 * Initializes once with the pt-BR/es-PY/en-US catalogs, pt-BR as fallback
 * language, and an initial language resolved via `resolveSupportedLocale`
 * (I18N-03) from the browser's reported languages. Does not read/write
 * localStorage (deferred to a later plan) and does not mount any provider —
 * that wiring happens in plan 01-03.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveSupportedLocale } from './config';
import ptBRCommon from './locales/pt-BR/common.json';
import ptBRNav from './locales/pt-BR/nav.json';
import esPYCommon from './locales/es-PY/common.json';
import esPYNav from './locales/es-PY/nav.json';
import enUSCommon from './locales/en-US/common.json';
import enUSNav from './locales/en-US/nav.json';

const resources = {
  'pt-BR': { common: ptBRCommon, nav: ptBRNav },
  'es-PY': { common: esPYCommon, nav: esPYNav },
  'en-US': { common: enUSCommon, nav: enUSNav },
} as const;

const detectedLanguages =
  typeof navigator !== 'undefined' && navigator.languages ? navigator.languages : [];

const initialLocale =
  detectedLanguages.length > 0 ? resolveSupportedLocale(detectedLanguages) : DEFAULT_LOCALE;

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    ns: ['common', 'nav'],
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export const i18n = i18next;
export default i18n;
