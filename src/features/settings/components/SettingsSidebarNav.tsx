import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { SETTINGS_NAV_ITEMS, type SettingsSectionId } from '../settingsSections';

type SettingsSidebarNavProps = {
  active: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
};

export function SettingsSidebarNav({ active, onSelect }: SettingsSidebarNavProps) {
  return (
    <nav className="settings-sidebar-nav" aria-label="Seções de configurações">
      <ul className="settings-sidebar-nav__list hidden lg:block">
        {SETTINGS_NAV_ITEMS.map((item) => {
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
                  <span className="block text-[13px] font-medium leading-tight">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-doqyn-muted">{item.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="settings-tabs-nav lg:hidden" role="tablist" aria-label="Seções de configurações">
        {SETTINGS_NAV_ITEMS.map((item) => {
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
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
