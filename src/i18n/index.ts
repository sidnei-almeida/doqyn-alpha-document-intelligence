/**
 * Configured i18next singleton for the app shell.
 *
 * Initializes once with the pt-BR/es-PY/en-US catalogs, pt-BR as fallback
 * language, and an initial language resolved with a saved-preference-first
 * precedence (SEL-02): a valid `doqyn.locale` value in localStorage wins,
 * otherwise falls back to browser-language detection via
 * `resolveSupportedLocale` (I18N-03). Does not mount any provider — that
 * wiring happens in plan 01-03.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { getStoredLocale, resolveInitialLocale } from './localePreference';
import ptBRCommon from './locales/pt-BR/common.json';
import ptBRNav from './locales/pt-BR/nav.json';
import ptBRIdentifiers from './locales/pt-BR/identifiers.json';
import ptBRAuth from './locales/pt-BR/auth.json';
import esPYCommon from './locales/es-PY/common.json';
import esPYNav from './locales/es-PY/nav.json';
import esPYIdentifiers from './locales/es-PY/identifiers.json';
import esPYAuth from './locales/es-PY/auth.json';
import enUSCommon from './locales/en-US/common.json';
import enUSNav from './locales/en-US/nav.json';
import enUSIdentifiers from './locales/en-US/identifiers.json';
import enUSAuth from './locales/en-US/auth.json';

const resources = {
  'pt-BR': { common: ptBRCommon, nav: ptBRNav, identifiers: ptBRIdentifiers, auth: ptBRAuth },
  'es-PY': { common: esPYCommon, nav: esPYNav, identifiers: esPYIdentifiers, auth: esPYAuth },
  'en-US': { common: enUSCommon, nav: enUSNav, identifiers: enUSIdentifiers, auth: enUSAuth },
} as const;

const detectedLanguages =
  typeof navigator !== 'undefined' && navigator.languages ? navigator.languages : [];

const initialLocale = resolveInitialLocale(getStoredLocale(), detectedLanguages);

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    ns: ['common', 'nav', 'identifiers', 'auth'],
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export const i18n = i18next;
export default i18n;
