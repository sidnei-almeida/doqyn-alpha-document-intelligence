import { useSearchParams } from 'react-router-dom';
import { SidebarBrandLogo } from '@/components/brand';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/auth/useAuth';
import { NAV_ITEMS_ADMIN, NAV_ITEMS_LIBRARY_VIEWS } from '@/lib/constants';
import { canViewDocumentTracking } from '@/features/tracking/utils/trackingAccess';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { findLibraryCategory } from '@/features/library/utils/resolveLibraryCategory';
import { NewButtonMenu } from '@/features/library/components/NewButtonMenu';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { SidebarStoragePanel } from './SidebarStoragePanel';
import { useSidebarCollapsed } from './useSidebarCollapsed';

interface SidebarProps {
  className?: string;
}

/**
 * Sidebar do workspace — navegação essencial estilo file manager.
 * Pastas/categorias ficam na Biblioteca, não duplicadas aqui.
 */
export function Sidebar({ className }: SidebarProps) {
  const { user, roles, hasAnyRole, membership } = useAuth();
  const [searchParams] = useSearchParams();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  const canManageUsers = hasAnyRole(['doqyn_admin', 'company_admin']);
  const canAccessRules = canAccessRulesPage(hasAnyRole);
  const canViewTracking = canViewDocumentTracking(roles, user?.role, membership?.status);
  const canManageDeactivated = hasAnyRole(['doqyn_admin', 'company_admin', 'individual_admin']);

  const libraryViewItems = NAV_ITEMS_LIBRARY_VIEWS;

  const adminNavItems = NAV_ITEMS_ADMIN.filter((item) => {
    if ('adminOnly' in item && item.adminOnly && !canManageDeactivated) return false;
    if ('governanceOnly' in item && item.governanceOnly && !canAccessRules) return false;
    if ('managerOnly' in item && item.managerOnly && !canManageUsers) return false;
    if ('trackingOnly' in item && item.trackingOnly && !canViewTracking) return false;
    return true;
  });

  const { data: categories = [] } = useDocumentCategories();
  const activeSpaceParam = searchParams.get('space') ?? '';
  const activeCategory = activeSpaceParam
    ? findLibraryCategory(activeSpaceParam, categories)
    : undefined;
  const uploadContext = activeCategory
    ? { categoryId: activeCategory.id, categoryName: activeCategory.name }
    : undefined;

  return (
    <aside
      className={cn(
        'workspace-sidebar flex h-full min-h-0 shrink-0 flex-col self-stretch bg-doqyn-shell transition-[width,min-width] duration-200',
        className,
      )}
      data-testid="workspace-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <header
        className={cn(
          'flex shrink-0 flex-col items-center',
          collapsed ? 'gap-2 px-2 pb-1.5 pt-3' : 'gap-3 px-3 pb-2 pt-4',
        )}
      >
        <div
          className={cn('w-full', collapsed ? 'flex flex-col items-center gap-1.5' : 'relative')}
        >
          <div
            className={cn('flex w-full items-center justify-center gap-1.5', !collapsed && 'px-7')}
          >
            <SidebarBrandLogo collapsed={collapsed} />
            {!collapsed && <span className="plan-badge">Alpha</span>}
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'explorer-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-doqyn-subtle transition-colors',
              'hover:bg-doqyn-surface-hover/50 hover:text-doqyn-muted',
              !collapsed && 'absolute right-0 top-1/2 z-10 -translate-y-1/2',
            )}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            data-testid="sidebar-collapse-toggle"
          >
            <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={ICON_SIZE.sm} />
          </button>
        </div>

        <NewButtonMenu
          uploadContext={uploadContext}
          className={collapsed ? 'w-10' : 'w-full'}
          collapsed={collapsed}
        />
      </header>

      <nav
        className={cn(
          'workspace-sidebar-nav flex flex-1 flex-col px-2',
          collapsed ? 'gap-1 overflow-hidden py-1.5' : 'scrollbar-thin gap-1 overflow-y-auto py-2',
        )}
      >
        <SidebarSection collapsed={collapsed}>
          <SidebarNavItem
            item={{ label: 'Biblioteca', path: '/biblioteca', icon: 'folder', end: true }}
            collapsed={collapsed}
          />
          {libraryViewItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </SidebarSection>

        {!collapsed && <div className="mx-2 my-3 h-px bg-doqyn-border-hairline" aria-hidden />}

        <SidebarSection label="Administração" className="mt-5" collapsed={collapsed}>
          {adminNavItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </SidebarSection>
      </nav>

      {!collapsed && <SidebarStoragePanel />}
    </aside>
  );
}
