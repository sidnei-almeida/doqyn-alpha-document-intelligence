import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from './SidebarTooltip';
import { useTranslation } from 'react-i18next';

export type SidebarNavItemConfig = {
  /** Chave do catálogo, não a frase: a lista vem de `lib/constants.ts`, que é `.ts` e não traduz. */
  labelKey: string;
  path: string;
  icon: string;
  /** Ativa apenas em match exato (evita destacar a raiz junto com sub-rotas). */
  end?: boolean;
  /** Usado pela Sidebar para filtrar itens admin-only; ignorado no render. */
  adminOnly?: boolean;
};

type SidebarNavItemProps = {
  item: SidebarNavItemConfig;
  collapsed?: boolean;
};

const navLinkClass = (isActive: boolean, collapsed: boolean) =>
  cn(
    'sidebar-nav-link group explorer-interactive flex items-center gap-3 font-display text-label leading-none',
    'focus-visible:outline-none focus-visible:shadow-[var(--sidebar-focus-ring)]',
    collapsed ? 'h-9 w-10 justify-center px-0' : 'h-10 pl-3.5 pr-3',
    isActive
      ? 'sidebar-nav-link--active font-medium'
      : 'font-normal text-doqyn-muted hover:text-doqyn-text',
  );

/** Item de navegação — ícone + label; ativo marcado por régua de acento. */
export function SidebarNavItem({ item, collapsed = false }: SidebarNavItemProps) {
  const { t } = useTranslation('common');
  const link = (
    <NavLink
      to={item.path}
      end={item.end}
      // Âncora do tour: o holofote recorta o item de verdade, e o roteiro se
      // refere a ele pelo destino — não pela posição na lista, que muda com o
      // papel de quem está olhando.
      data-tour={`nav:${item.path}`}
      className={({ isActive }) => navLinkClass(isActive, collapsed)}
    >
      {({ isActive }) => (
        <>
          <Icon
            name={item.icon}
            filled={isActive}
            size={ICON_SIZE.nav}
            className={cn(
              'shrink-0',
              isActive
                ? 'text-doqyn-sidebar-selected-icon'
                : 'text-doqyn-muted group-hover:text-doqyn-text',
            )}
          />
          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <SidebarTooltip label={t(item.labelKey)} collapsed={collapsed}>
      {link}
    </SidebarTooltip>
  );
}

export const NAV_ICON_SIZE = ICON_SIZE.nav;
