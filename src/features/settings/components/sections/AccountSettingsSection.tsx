import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';

/** Perfil em tela única: identidade em largura total; preferências e acesso em grade. */
export function AccountSettingsSection() {
  return (
    <div className="settings-composite-section settings-profile-page">
      <section className="settings-profile-block settings-profile-block--identity">
        <SettingsSectionHeader
          title="Identidade"
          description="Foto, papéis e detalhes da conta."
          className="settings-profile-block-header"
        />
        <ProfileSettingsSection />
      </section>

      <div className="settings-profile-secondary-grid">
        <section className="settings-profile-block">
          <SettingsSectionHeader
            title="Preferências"
            description="Tema e visualização da Biblioteca."
            className="settings-profile-block-header"
          />
          <PreferencesSettingsSection />
        </section>

        <section className="settings-profile-block">
          <SettingsSectionHeader
            title="Acesso"
            description="Autenticação e senha."
            className="settings-profile-block-header"
          />
          <AuthenticationSettingsSection />
        </section>
      </div>
    </div>
  );
}
