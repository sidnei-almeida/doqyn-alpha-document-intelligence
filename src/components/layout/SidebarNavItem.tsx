import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from './SidebarTooltip';

export type SidebarNavItemConfig = {
  label: string;
  path: string;
  icon: string;
  /** Ativa apenas em match exato (evita destacar a raiz junto com sub-rotas). */
  end?: boolean;
};

type SidebarNavItemProps = {
  item: SidebarNavItemConfig;
  collapsed?: boolean;
};

const navLinkClass = (isActive: boolean, collapsed: boolean) =>
  cn(
    'group explorer-interactive flex items-center gap-3 rounded-full font-display text-label font-medium leading-none',
    collapsed ? 'h-9 w-10 justify-center px-0' : 'h-10 px-3',
    isActive
      ? 'bg-doqyn-sidebar-selected text-doqyn-sidebar-selected-text'
      : 'text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
  );

/** Item de navegação — ícone + label; ativo com fundo suave e fill. */
export function SidebarNavItem({ item, collapsed = false }: SidebarNavItemProps) {
  const link = (
    <NavLink to={item.path} end={item.end} className={({ isActive }) => navLinkClass(isActive, collapsed)}>
      {({ isActive }) => (
        <>
          <Icon
            name={item.icon}
            filled={isActive}
            size={ICON_SIZE.nav}
            className={cn(
              'shrink-0',
              isActive ? 'text-doqyn-sidebar-selected-text' : 'text-doqyn-muted group-hover:text-doqyn-text',
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <SidebarTooltip label={item.label} collapsed={collapsed}>
      {link}
    </SidebarTooltip>
  );
}

export const NAV_ICON_SIZE = ICON_SIZE.nav;
