import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';

/** Coluna única: identidade, preferências e acesso empilhados, separados por fio. */
export function AccountSettingsSection() {
  return (
    <div className="settings-blocks settings-profile-page">
      <p className="settings-save-rule">
        Nesta tela, cada mudança vale na hora — só senha e e-mail pedem confirmação.
      </p>

      <section className="settings-block settings-profile-block--identity">
        <SettingsSectionHeader
          title="Identidade"
          description="Foto, papéis e detalhes da conta."
          className="settings-block__header"
        />
        <ProfileSettingsSection />
      </section>

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
  );
}
