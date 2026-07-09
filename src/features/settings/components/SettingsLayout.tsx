import type { ReactNode } from 'react';
import { SettingsSidebarNav } from './SettingsSidebarNav';
import type { SettingsSectionId } from '../settingsSections';
import { settingsSectionMeta } from '../settingsSections';

type SettingsLayoutProps = {
  section: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  children: ReactNode;
};

export function SettingsLayout({ section, onSectionChange, children }: SettingsLayoutProps) {
  const activeMeta = settingsSectionMeta(section);

  return (
    <div className="settings-shell">
      <aside className="settings-layout__nav" aria-label="Navegação de configurações">
        <SettingsSidebarNav active={section} onSelect={onSectionChange} />
      </aside>
      <div className="settings-layout__content">
        <div className="settings-content-panel" aria-labelledby="settings-active-section-title">
          <p className="settings-content-panel__eyebrow">Configurações da conta</p>
          <h2 id="settings-active-section-title" className="settings-content-panel__title">
            {activeMeta.label}
          </h2>
          <p className="settings-content-panel__description">{activeMeta.description}</p>
          <div className="settings-content-panel__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
