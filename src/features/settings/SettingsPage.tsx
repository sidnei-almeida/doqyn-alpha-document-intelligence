import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/auth/useAuth';
import { SettingsLayout } from './components/SettingsLayout';
import { AccountSettingsSection } from './components/sections/AccountSettingsSection';
import { OrganizationSection } from './components/sections/OrganizationSection';
import { useSettingsSection } from './hooks/useSettingsSection';
import {
  settingsSectionMeta,
  visibleSettingsNavItems,
  type SettingsSectionId,
} from './settingsSections';
import { SETTINGS_UI_PATTERN } from './settingsUiPattern';

function SettingsSectionPanel({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case 'organizacao':
      return <OrganizationSection />;
    default:
      return <AccountSettingsSection />;
  }
}

export function SettingsPage() {
  const { section, setSection } = useSettingsSection();
  const { tenant } = useAuth();
  const navItems = visibleSettingsNavItems(tenant?.tenantType);
  const meta = settingsSectionMeta(section, tenant?.tenantType);

  return (
    <PageShell
      eyebrow={SETTINGS_UI_PATTERN.pageEyebrow}
      title={meta.label}
      description={meta.description}
      className="settings-page-shell"
      bodyClassName="min-h-0 settings-page"
    >
      <SettingsLayout section={section} items={navItems} onSectionChange={setSection}>
        <SettingsSectionPanel section={section} />
      </SettingsLayout>
    </PageShell>
  );
}
