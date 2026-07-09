import { PageShell } from '@/components/layout/PageShell';
import { SettingsLayout } from './components/SettingsLayout';
import { AuthenticationSettingsSection } from './components/sections/AuthenticationSettingsSection';
import { OrganizationSettingsSection } from './components/sections/OrganizationSettingsSection';
import { PreferencesSettingsSection } from './components/sections/PreferencesSettingsSection';
import { ProfileSettingsSection } from './components/sections/ProfileSettingsSection';
import { SecuritySettingsSection } from './components/sections/SecuritySettingsSection';
import { SystemSettingsSection } from './components/sections/SystemSettingsSection';
import { UploadAiSettingsSection } from './components/sections/UploadAiSettingsSection';
import { useSettingsSection } from './hooks/useSettingsSection';
import type { SettingsSectionId } from './settingsSections';

function SettingsSectionPanel({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case 'perfil':
      return <ProfileSettingsSection />;
    case 'preferencias':
      return <PreferencesSettingsSection />;
    case 'upload-ia':
      return <UploadAiSettingsSection />;
    case 'seguranca':
      return <SecuritySettingsSection />;
    case 'autenticacao':
      return <AuthenticationSettingsSection />;
    case 'organizacao':
      return <OrganizationSettingsSection />;
    case 'sistema':
      return <SystemSettingsSection />;
    default:
      return <ProfileSettingsSection />;
  }
}

export function SettingsPage() {
  const { section, setSection } = useSettingsSection();

  return (
    <PageShell
      eyebrow="Administração"
      title="Configurações"
      description="Perfil, preferências, upload, segurança e demais opções da sua conta."
      bodyClassName="min-h-0 settings-page"
    >
      <SettingsLayout section={section} onSectionChange={setSection}>
        <SettingsSectionPanel section={section} />
      </SettingsLayout>
    </PageShell>
  );
}
