import { useTranslation } from 'react-i18next';
import { useLocale } from '@/i18n/useLocale';
import type { SupportedLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Reusable, catalog-driven language selector (SEL-01). Reused by the header
 * account popover and Settings > Preferences (D-05). Options come from
 * `useLocale().supportedLocales` and labels from the `language.*` catalog
 * keys — no hardcoded native names.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  const { locale, setLocale, supportedLocales } = useLocale();

  return (
    <div
      className={cn('settings-segmented-control', className)}
      role="radiogroup"
      aria-label={t('language.label')}
    >
      {supportedLocales.map((loc: SupportedLocale) => {
        const active = locale === loc;
        return (
          <button
            key={loc}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(loc)}
            className={cn(
              'settings-segmented-control__item',
              active && 'settings-segmented-control__item--active',
            )}
          >
            {t(`language.${loc}`)}
          </button>
        );
      })}
    </div>
  );
}
