import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import {
  getLibraryDefaultView,
  setLibraryDefaultView,
  type LibraryDefaultView,
} from '@/features/library/utils/libraryDefaultView';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';
import { SettingsRow, SettingsRowList } from '../SettingsRow';
import { SettingsSectionBody } from '../SettingsSectionBody';

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Escuro', icon: 'dark_mode' },
];

const VIEW_OPTIONS: Array<{ value: LibraryDefaultView; label: string; icon: string }> = [
  { value: 'grid', label: 'Grade', icon: 'grid_view' },
  { value: 'list', label: 'Lista', icon: 'view_list' },
];

export function PreferencesSettingsSection() {
  const { theme, setTheme } = useTheme();
  const [defaultView, setDefaultView] = useState<LibraryDefaultView>('grid');

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
        <SettingsRow
          label="Tema"
          description="Alterna entre modo claro e escuro. Salvo neste navegador."
          control={
            <div
              className="settings-segmented-control"
              role="radiogroup"
              aria-label="Tema da interface"
            >
              {THEME_OPTIONS.map((option) => {
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'settings-segmented-control__item',
                      active && 'settings-segmented-control__item--active',
                    )}
                  >
                    <Icon name={option.icon} size={ICON_SIZE.xs} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
          }
        />

        <SettingsRow
          label="Visualização padrão da Biblioteca"
          description="Aplicado ao abrir a Biblioteca sem preferência na URL."
          control={
            <div
              className="settings-segmented-control"
              role="radiogroup"
              aria-label="Visualização padrão da Biblioteca"
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
                    {option.label}
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
