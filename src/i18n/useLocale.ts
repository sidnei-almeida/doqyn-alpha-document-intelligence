/**
 * Leitura e troca do idioma da interface.
 *
 * O que a Fase 2 vai mudar aqui: `setLocale` passará a gravar em `AuthUser.locale` pelo
 * auth-service, e não só no `localStorage`. A gravação local continua, como cache de arranque
 * — é ela que impede o app de piscar no idioma errado antes de a sessão chegar. O que não pode
 * continuar é ser a única memória: e-mail é renderizado pelo servidor, que não enxerga o
 * navegador de ninguém.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { i18n } from './index';
import {
  DEFAULT_LOCALE,
  EXPOSED_LOCALES,
  LOCALES,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
} from './locales';
import type { LocaleDefinition, SupportedLocale } from './locales';

function subscribe(onChange: () => void): () => void {
  i18n.on('languageChanged', onChange);
  return () => {
    i18n.off('languageChanged', onChange);
  };
}

function currentLocale(): SupportedLocale {
  return normalizeLocale(i18n.language) ?? DEFAULT_LOCALE;
}

export type UseLocaleResult = {
  locale: SupportedLocale;
  /** Todos os idiomas conhecidos, inclusive os que ainda não são oferecidos. */
  locales: LocaleDefinition[];
  /** Se este idioma já pode ser escolhido por alguém que não conhece `?lang=`. */
  isExposed: (locale: SupportedLocale) => boolean;
  setLocale: (locale: SupportedLocale) => void;
};

export function useLocale(): UseLocaleResult {
  const locale = useSyncExternalStore(subscribe, currentLocale, () => DEFAULT_LOCALE);

  const setLocale = useCallback((next: SupportedLocale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* Navegador com armazenamento bloqueado ainda troca de idioma — só não lembra depois. */
    }
    void i18n.changeLanguage(next);
  }, []);

  const isExposed = useCallback(
    (candidate: SupportedLocale) => EXPOSED_LOCALES.includes(candidate),
    [],
  );

  return { locale, locales: LOCALES, isExposed, setLocale };
}
