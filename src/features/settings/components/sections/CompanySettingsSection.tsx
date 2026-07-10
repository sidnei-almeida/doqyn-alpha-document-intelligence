import { useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import {
  COMPANY_SETTINGS_TABS,
  type CompanySettingsTab,
} from '../../settingsSections';
import { SettingsSubTabs } from '../SettingsSubTabs';
import { OrganizationSettingsSection } from './OrganizationSettingsSection';
import { SystemSettingsSection } from './SystemSettingsSection';
import { TrashRetentionSettingsSection } from './TrashRetentionSettingsSection';

type CompanySettingsSectionProps = {
  tab: CompanySettingsTab;
  onTabChange: (tab: CompanySettingsTab) => void;
};

export function CompanySettingsSection({ tab, onTabChange }: CompanySettingsSectionProps) {
  const { hasAnyRole } = useAuth();
  const canManageRetention = hasAnyRole(['doqyn_admin', 'company_admin']);
  const canAccessRules = canAccessRulesPage(hasAnyRole);

  const tabs = useMemo(
    () =>
      COMPANY_SETTINGS_TABS.filter((item) => {
        if (item.id === 'retencao' && !canManageRetention) return false;
        if (item.id === 'governanca' && !canAccessRules) return false;
        return true;
      }),
    [canAccessRules, canManageRetention],
  );

  useEffect(() => {
    if (tab === 'retencao' && !canManageRetention) {
      onTabChange('sistema');
    }
    if (tab === 'governanca' && !canAccessRules) {
      onTabChange('sistema');
    }
  }, [canAccessRules, canManageRetention, onTabChange, tab]);

  return (
    <div className="settings-composite-section">
      <SettingsSubTabs
        items={tabs}
        active={tab}
        onSelect={onTabChange}
        ariaLabel="Subseções de empresa"
      />
      {tab === 'governanca' && <OrganizationSettingsSection />}
      {tab === 'retencao' && canManageRetention && <TrashRetentionSettingsSection />}
      {tab === 'sistema' && <SystemSettingsSection />}
    </div>
  );
}
