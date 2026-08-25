import { useEffect } from 'react';
import { useAuth } from '@/auth/useAuth';
import { PageShell } from '@/components/layout/PageShell';
import { SettingsLayout } from './components/SettingsLayout';
import { AccountSettingsSection } from './components/sections/AccountSettingsSection';
import { OrganizationSection } from './components/sections/OrganizationSection';
import { SystemSection } from './components/sections/SystemSection';
import { useSettingsSection } from './hooks/useSettingsSection';
import {
  canViewSettingsSection,
  DEFAULT_SETTINGS_SECTION,
  settingsSectionMeta,
  visibleSettingsNavItems,
  type SettingsSectionId,
} from './settingsSections';
import { SETTINGS_UI_PATTERN } from './settingsUiPattern';

function SettingsSectionPanel({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case 'organizacao':
      return <OrganizationSection />;
    case 'sistema':
      return <SystemSection />;
    default:
      return <AccountSettingsSection />;
  }
}

export function SettingsPage() {
  const { section, setSection } = useSettingsSection();
  const { hasAnyRole, tenant } = useAuth();

  const access = {
    tenantType: tenant?.tenantType,
    isCompanyAdmin: hasAnyRole(['company_admin']),
  };
  const navItems = visibleSettingsNavItems(access);
  const allowed = canViewSettingsSection(section, access);
  const activeSection = allowed ? section : DEFAULT_SETTINGS_SECTION;
  const meta = settingsSectionMeta(activeSection);

  useEffect(() => {
    if (!allowed) {
      setSection(DEFAULT_SETTINGS_SECTION);
    }
  }, [allowed, setSection]);

  return (
    <PageShell
      eyebrow={SETTINGS_UI_PATTERN.pageEyebrow}
      title={meta.label}
      description={meta.description}
      bodyClassName="min-h-0 settings-page"
    >
      <SettingsLayout section={activeSection} items={navItems} onSectionChange={setSection}>
        <SettingsSectionPanel section={activeSection} />
      </SettingsLayout>
    </PageShell>
  );
}
