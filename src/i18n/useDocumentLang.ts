/**
 * Keeps `document.documentElement.lang` in sync with the active i18next
 * language (I18N-04). Sets it once on mount and again whenever i18next
 * fires `languageChanged`, cleaning up the subscription on unmount.
 *
 * Only values already resolved by i18next (constrained to
 * `SUPPORTED_LOCALES` via `supportedLngs`) are written to the DOM — no
 * user-controlled free text reaches the `lang` attribute.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useDocumentLang(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    const applyLang = (lng: string) => {
      document.documentElement.lang = lng;
    };

    applyLang(i18n.language);

    i18n.on('languageChanged', applyLang);

    return () => {
      i18n.off('languageChanged', applyLang);
    };
  }, [i18n]);
}
