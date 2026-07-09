import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import {
  getLibraryDefaultView,
  setLibraryDefaultView,
  type LibraryDefaultView,
} from '@/features/library/utils/libraryDefaultView';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';
import { SettingsFieldGroup } from '../SettingsFieldGroup';
import { SettingsInfoCard } from '../SettingsInfoCard';
import { SettingsSectionBody } from '../SettingsSectionBody';

const VIEW_OPTIONS: Array<{ value: LibraryDefaultView; label: string; icon: string }> = [
  { value: 'grid', label: 'Grade', icon: 'grid_view' },
  { value: 'list', label: 'Lista', icon: 'view_list' },
];

export function PreferencesSettingsSection() {
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
      <div className="settings-cards-grid">
        <SettingsCard>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="settings-info-card__icon" aria-hidden>
                <Icon name="dark_mode" size={ICON_SIZE.xs} />
              </span>
              <div>
                <p className="text-sm font-medium text-doqyn-text">Tema</p>
                <p className="mt-0.5 text-sm text-doqyn-muted">
                  Alterne entre modo claro e escuro. Salvo neste navegador.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </SettingsCard>

        <SettingsFieldGroup
          title="Visualização padrão da Biblioteca"
          description="Aplicado ao abrir a Biblioteca sem preferência na URL."
        >
          <div className="settings-segmented-control" role="radiogroup" aria-label="Visualização padrão da Biblioteca">
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
        </SettingsFieldGroup>
      </div>

      <SettingsInfoCard
        icon="view_list"
        title="Densidade visual"
        description="Controle de espaçamento compacto ou confortável em tabelas e listas."
        status="pending"
      />
    </SettingsSectionBody>
  );
}
