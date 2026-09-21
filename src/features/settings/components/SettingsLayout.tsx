import type { ReactNode } from 'react';
import { SettingsSidebarNav } from './SettingsSidebarNav';
import type { SettingsNavItem, SettingsSectionId } from '../settingsSections';
import { useTranslation } from 'react-i18next';

type SettingsLayoutProps = {
  section: SettingsSectionId;
  items: SettingsNavItem[];
  onSectionChange: (section: SettingsSectionId) => void;
  children: ReactNode;
};

/**
 * Shell de duas colunas. O título da seção fica só no PageShell —
 * o painel de conteúdo não repete eyebrow/título/descrição.
 */
export function SettingsLayout({ section, items, onSectionChange, children }: SettingsLayoutProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="settings-shell">
      <aside
        className="settings-layout__nav"
        aria-label={t('settingsLayout.navegacaoDeConfiguracoes')}
      >
        <SettingsSidebarNav active={section} items={items} onSelect={onSectionChange} />
      </aside>
      <div className="settings-layout__content">
        <div
          className="settings-content-panel"
          role="region"
          aria-label={t('settingsLayout.conteudoDaSecaoDe')}
        >
          <div className="settings-content-panel__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
