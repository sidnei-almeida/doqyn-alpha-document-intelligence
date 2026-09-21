import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { SettingsNavItem, SettingsSectionId } from '../settingsSections';
import { useTranslation } from 'react-i18next';

type SettingsSidebarNavProps = {
  active: SettingsSectionId;
  items: SettingsNavItem[];
  onSelect: (section: SettingsSectionId) => void;
};

export function SettingsSidebarNav({ active, items, onSelect }: SettingsSidebarNavProps) {
  const { t } = useTranslation('settings');

  return (
    <nav
      className="settings-sidebar-nav"
      aria-label={t('settingsSidebarNav.secoesDeConfiguracoes')}
    >
      <ul className="settings-sidebar-nav__list">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn('settings-nav-item', isActive && 'settings-nav-item--active')}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  name={item.icon}
                  filled={isActive}
                  size={ICON_SIZE.sm}
                  className={cn('shrink-0', isActive && 'text-doqyn-accent-active')}
                />
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] font-medium leading-tight">
                    {t(item.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-doqyn-muted">
                    {t(item.descriptionKey)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className="settings-tabs-nav"
        role="tablist"
        aria-label={t('settingsSidebarNav.secoesDeConfiguracoes2')}
      >
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(item.id)}
              className={cn('settings-tab-item', isActive && 'settings-tab-item--active')}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
