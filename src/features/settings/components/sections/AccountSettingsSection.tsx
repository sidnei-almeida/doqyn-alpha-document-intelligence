import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';

/** Perfil em tela única: identidade em largura total; preferências e acesso em grade. */
export function AccountSettingsSection() {
  return (
    <div className="settings-blocks settings-profile-page">
      <section className="settings-block settings-profile-block--identity">
        <SettingsSectionHeader
          title="Identidade"
          description="Foto, papéis e detalhes da conta."
          className="settings-block__header"
        />
        <ProfileSettingsSection />
      </section>

      <div className="settings-profile-secondary-grid">
        <section className="settings-block">
          <SettingsSectionHeader
            title="Preferências"
            description="Tema e visualização da Biblioteca."
            className="settings-block__header"
          />
          <PreferencesSettingsSection />
        </section>

        <section className="settings-block">
          <SettingsSectionHeader
            title="Acesso"
            description="Autenticação e senha."
            className="settings-block__header"
          />
          <AuthenticationSettingsSection />
        </section>
      </div>
    </div>
  );
}
