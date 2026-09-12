import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/useTheme';
import { useLocale } from '@/i18n/useLocale';
import { Icon } from '@/components/ui/Icon';
import {
  getLibraryDefaultView,
  setLibraryDefaultView,
  type LibraryDefaultView,
} from '@/features/library/utils/libraryDefaultView';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { THEMES, THEME_ICONS, THEME_LABEL_KEYS, THEME_HINT_KEYS } from '@/lib/theme';
import { SettingsRow, SettingsRowList } from '../SettingsRow';
import { SettingsSectionBody } from '../SettingsSectionBody';

/**
 * Os temas vêm de `src/lib/theme.ts`, não de uma cópia local.
 *
 * Havia aqui uma lista própria com dois itens, e o `standard` — que é o tema em que todo
 * mundo começa — não estava nela. Quem nunca trocou de tema abria esta tela e via os dois
 * botões apagados, sem nenhum marcado: o controle dizia que a pessoa não tinha tema, quando
 * na verdade tinha o padrão. Lista duplicada diverge; esta lê a fonte.
 */
const THEME_OPTIONS = THEMES.map((value) => ({
  value,
  labelKey: THEME_LABEL_KEYS[value],
  hintKey: THEME_HINT_KEYS[value],
  icon: THEME_ICONS[value],
}));

const VIEW_OPTIONS: Array<{ value: LibraryDefaultView; labelKey: string; icon: string }> = [
  { value: 'grid', labelKey: 'preferencesSettingsSection.view.grid', icon: 'grid_view' },
  { value: 'list', labelKey: 'preferencesSettingsSection.view.list', icon: 'view_list' },
];

export function PreferencesSettingsSection() {
  const { t } = useTranslation(['settings', 'common', 'components']);
  const { theme, setTheme } = useTheme();
  const { locale, locales, isExposed, setLocale, isSaving, saveError } = useLocale();
  const [defaultView, setDefaultView] = useState<LibraryDefaultView>('grid');
  const hasDraftLocale = locales.some((option) => !isExposed(option.code));

  useEffect(() => {
    setDefaultView(getLibraryDefaultView());
  }, []);

  function handleViewChange(value: LibraryDefaultView) {
    setDefaultView(value);
    setLibraryDefaultView(value);
  }

  return (
    <SettingsSectionBody>
      <SettingsRowList>
        {/* O idioma da interface é escolha da pessoa, não do país: quem tem CPF pode
            preferir ler o app em inglês, e continua tendo CPF. Por isso esta linha não
            consulta nada da conta além da preferência declarada.

            Os idiomas em tradução aparecem desabilitados em vez de ocultos. Esconder
            faria parecer que não existem; mostrar pela metade faria parecer abandono.
            Nomeá-los como "em preparo" é a única leitura honesta das três. */}
        <SettingsRow
          label={t('common:locale.label')}
          description={
            saveError
              ? t('common:locale.saveFailed')
              : hasDraftLocale
                ? t('common:locale.descriptionWithDrafts')
                : t('common:locale.description')
          }
          control={
            <div
              className="settings-segmented-control"
              role="radiogroup"
              aria-label={t('common:locale.label')}
            >
              {locales.map((option) => {
                const active = locale === option.code;
                const exposed = isExposed(option.code);
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!exposed || isSaving}
                    lang={option.code}
                    title={exposed ? option.nativeName : t('common:locale.inPreparation')}
                    onClick={() => void setLocale(option.code)}
                    className={cn(
                      'settings-segmented-control__item',
                      active && 'settings-segmented-control__item--active',
                      !exposed && 'opacity-45',
                    )}
                  >
                    {option.short}
                  </button>
                );
              })}
            </div>
          }
        />
        <SettingsRow
          label={t('preferencesSettingsSection.tema')}
          description={t('preferencesSettingsSection.padraoClaroOuEscuro')}
          control={
            <div
              className="settings-segmented-control"
              role="radiogroup"
              aria-label={t('preferencesSettingsSection.temaDaInterface')}
            >
              {THEME_OPTIONS.map((option) => {
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={t(option.hintKey)}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'settings-segmented-control__item',
                      active && 'settings-segmented-control__item--active',
                    )}
                  >
                    <Icon name={option.icon} size={ICON_SIZE.xs} aria-hidden />
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          }
        />

        <SettingsRow
          label={t('preferencesSettingsSection.visualizacaoPadraoDaBiblioteca')}
          description={t('preferencesSettingsSection.aplicadoAoAbrirA')}
          control={
            <div
              className="settings-segmented-control"
              role="radiogroup"
              aria-label={t('preferencesSettingsSection.visualizacaoPadraoDaBiblioteca2')}
            >
              {VIEW_OPTIONS.map((option) => {
                const active = defaultView === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleViewChange(option.value)}
                    className={cn(
                      'settings-segmented-control__item',
                      active && 'settings-segmented-control__item--active',
                    )}
                  >
                    <Icon name={option.icon} size={ICON_SIZE.xs} aria-hidden />
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          }
        />
      </SettingsRowList>
    </SettingsSectionBody>
  );
}
