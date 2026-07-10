import {
  ACCOUNT_SETTINGS_TABS,
  type AccountSettingsTab,
} from '../../settingsSections';
import { SettingsSubTabs } from '../SettingsSubTabs';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';

type AccountSettingsSectionProps = {
  tab: AccountSettingsTab;
  onTabChange: (tab: AccountSettingsTab) => void;
};

export function AccountSettingsSection({ tab, onTabChange }: AccountSettingsSectionProps) {
  return (
    <div className="settings-composite-section">
      <SettingsSubTabs
        items={ACCOUNT_SETTINGS_TABS}
        active={tab}
        onSelect={onTabChange}
        ariaLabel="Subseções de perfil"
      />
      {tab === 'identidade' && <ProfileSettingsSection />}
      {tab === 'preferencias' && <PreferencesSettingsSection />}
      {tab === 'acesso' && <AuthenticationSettingsSection />}
    </div>
  );
}
