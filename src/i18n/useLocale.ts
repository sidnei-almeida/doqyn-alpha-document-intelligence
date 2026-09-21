/**
 * Leitura e troca do idioma da interface.
 *
 * A escolha vive no perfil, no `doqyn-auth-service` — não no navegador. O `localStorage`
 * continua sendo escrito, mas só como cache de arranque: é ele que evita o app piscar no
 * idioma errado no quadro anterior à chegada da sessão. Quem manda, quando a sessão chega,
 * é o servidor (ver `LocaleSync`).
 *
 * A troca é otimista: a tela muda na hora e a gravação vai atrás. Se a gravação falhar, o
 * idioma volta ao que era — mostrar inglês e ter guardado português seria pior que não trocar.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { accountPreferencesApi } from '@/features/settings/api/accountPreferencesApi';
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

/** Cache de arranque. Falha em silêncio: navegador com armazenamento bloqueado ainda troca. */
export function rememberLocale(locale: SupportedLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* Sem memória local o idioma ainda vale nesta sessão; só não sobrevive ao recarregar. */
  }
}

export type UseLocaleResult = {
  locale: SupportedLocale;
  /** Todos os idiomas conhecidos, inclusive os que ainda não são oferecidos. */
  locales: LocaleDefinition[];
  /** Se este idioma já pode ser escolhido por alguém que não conhece `?lang=`. */
  isExposed: (locale: SupportedLocale) => boolean;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  /** Verdadeiro enquanto a gravação no perfil não confirma. */
  isSaving: boolean;
  /** Preenchido quando a gravação falhou e o idioma foi revertido. */
  saveError: boolean;
};

export function useLocale(): UseLocaleResult {
  const locale = useSyncExternalStore(subscribe, currentLocale, () => DEFAULT_LOCALE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const setLocale = useCallback(async (next: SupportedLocale) => {
    const previous = currentLocale();
    if (next === previous) return;

    setSaveError(false);
    setIsSaving(true);
    rememberLocale(next);
    await i18n.changeLanguage(next);

    try {
      await accountPreferencesApi.update({ locale: next });
    } catch {
      /* Reverte tela e cache juntos: guardar uma escolha que o servidor recusou faria o
           idioma "voltar sozinho" no próximo login, sem explicação. */
      rememberLocale(previous);
      await i18n.changeLanguage(previous);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const isExposed = useCallback(
    (candidate: SupportedLocale) => EXPOSED_LOCALES.includes(candidate),
    [],
  );

  return { locale, locales: LOCALES, isExposed, setLocale, isSaving, saveError };
}
