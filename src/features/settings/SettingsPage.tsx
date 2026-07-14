import { PageShell } from '@/components/layout/PageShell';
import { SettingsLayout } from './components/SettingsLayout';
import { AccountSettingsSection } from './components/sections/AccountSettingsSection';
import { CompanySettingsSection } from './components/sections/CompanySettingsSection';
import { SecuritySettingsSection } from './components/sections/SecuritySettingsSection';
import { UploadAiSettingsSection } from './components/sections/UploadAiSettingsSection';
import { useSettingsSection } from './hooks/useSettingsSection';
import type { CompanySettingsTab, SettingsSectionId } from './settingsSections';
import { settingsSectionMeta } from './settingsSections';
import { SETTINGS_UI_PATTERN } from './settingsUiPattern';

function SettingsSectionPanel({
  section,
  tab,
  setCompanyTab,
}: {
  section: SettingsSectionId;
  tab: ReturnType<typeof useSettingsSection>['tab'];
  setCompanyTab: (tab: CompanySettingsTab) => void;
}) {
  switch (section) {
    case 'perfil':
      return <AccountSettingsSection />;
    case 'upload-ia':
      return <UploadAiSettingsSection />;
    case 'seguranca':
      return <SecuritySettingsSection />;
    case 'empresa':
      return (
        <CompanySettingsSection
          tab={(tab ?? 'governanca') as CompanySettingsTab}
          onTabChange={setCompanyTab}
        />
      );
    default:
      return <AccountSettingsSection />;
  }
}

export function SettingsPage() {
  const { section, tab, setSection, setCompanyTab } = useSettingsSection();
  const meta = settingsSectionMeta(section);

  return (
    <PageShell
      eyebrow={SETTINGS_UI_PATTERN.pageEyebrow}
      title={meta.label}
      description={meta.description}
      bodyClassName="min-h-0 settings-page"
    >
      <SettingsLayout section={section} onSectionChange={setSection}>
        <SettingsSectionPanel
          section={section}
          tab={tab}
          setCompanyTab={setCompanyTab}
        />
      </SettingsLayout>
    </PageShell>
  );
}
