import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';
import { useTranslation } from 'react-i18next';

/** Coluna única: identidade, preferências e acesso empilhados, separados por fio. */
export function AccountSettingsSection() {
  const { t } = useTranslation('settings');

  return (
    <div className="settings-blocks settings-profile-page">
      <section className="settings-block settings-profile-block--identity">
        <SettingsSectionHeader
          title={t('accountSettingsSection.identidade')}
          description={t('accountSettingsSection.fotoPapeisEDetalhes')}
          className="settings-block__header"
        />
        <ProfileSettingsSection />
      </section>

      <section className="settings-block">
        <SettingsSectionHeader
          title={t('accountSettingsSection.preferencias')}
          description={t('accountSettingsSection.idiomaTemaEVisualizacao')}
          className="settings-block__header"
        />
        <PreferencesSettingsSection />
      </section>

      <section className="settings-block">
        <SettingsSectionHeader
          title={t('accountSettingsSection.acesso')}
          description={t('accountSettingsSection.senhaEEMail')}
          className="settings-block__header"
        />
        <AuthenticationSettingsSection />
      </section>
    </div>
  );
}
