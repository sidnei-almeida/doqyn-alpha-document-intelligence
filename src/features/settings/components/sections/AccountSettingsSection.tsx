import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { AuthenticationSettingsSection } from './AuthenticationSettingsSection';
import { PreferencesSettingsSection } from './PreferencesSettingsSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';

/** Coluna única: identidade, preferências e acesso empilhados, separados por fio. */
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

      <section className="settings-block">
        <SettingsSectionHeader
          title="Preferências"
          description="Idioma, tema e visualização da Biblioteca."
          className="settings-block__header"
        />
        <PreferencesSettingsSection />
      </section>

      <section className="settings-block">
        <SettingsSectionHeader
          title="Acesso"
          description="Senha e e-mail da conta."
          className="settings-block__header"
        />
        <AuthenticationSettingsSection />
      </section>
    </div>
  );
}
