import { useTranslation } from 'react-i18next';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  getActiveLocale,
} from '@/lib/formatLocale';

/**
 * Binds the central formatLocale functions to the active i18n locale,
 * re-deriving them whenever i18next fires `languageChanged` (via
 * `useTranslation()`'s subscription) so consumers re-render on locale switch.
 */
export function useLocaleFormatters() {
  const { i18n } = useTranslation();
  const locale = getActiveLocale();
  // Referenced to keep this hook subscribed to languageChanged re-renders.
  void i18n.language;

  return {
    formatDate: (
      value: Parameters<typeof formatDate>[0],
      opts?: Parameters<typeof formatDate>[1],
    ) => formatDate(value, opts, locale),
    formatDateTime: (
      value: Parameters<typeof formatDateTime>[0],
      opts?: Parameters<typeof formatDateTime>[1],
    ) => formatDateTime(value, opts, locale),
    formatTime: (
      value: Parameters<typeof formatTime>[0],
      opts?: Parameters<typeof formatTime>[1],
    ) => formatTime(value, opts, locale),
    formatNumber: (
      value: Parameters<typeof formatNumber>[0],
      opts?: Parameters<typeof formatNumber>[1],
    ) => formatNumber(value, opts, locale),
    locale,
  };
}
