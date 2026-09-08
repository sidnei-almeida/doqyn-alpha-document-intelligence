import { useSearchParams } from 'react-router-dom';
import { SidebarBrandLogo } from '@/components/brand';
import { SidebarEdgeToggle } from './SidebarEdgeToggle';
import { useAuth } from '@/auth/useAuth';
import { NAV_ITEMS_ADMIN, NAV_ITEMS_LIBRARY_VIEWS } from '@/lib/constants';
import { canViewDocumentTracking } from '@/features/tracking/utils/trackingAccess';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { findLibraryCategory } from '@/features/library/utils/resolveLibraryCategory';
import { NewButtonMenu } from '@/features/library/components/NewButtonMenu';
import { cn } from '@/lib/utils';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { SidebarUsage } from './SidebarUsage';
import { useSidebarCollapsed } from './useSidebarCollapsed';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  className?: string;
}

/**
 * Sidebar do workspace — navegação essencial estilo file manager.
 * Pastas/categorias ficam na Biblioteca, não duplicadas aqui.
 */
export function Sidebar({ className }: SidebarProps) {
  const { t } = useTranslation('components');

  const { user, roles, hasAnyRole, membership } = useAuth();
  const [searchParams] = useSearchParams();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  const canManageUsers = hasAnyRole(['company_admin']);
  const canAccessRules = canAccessRulesPage(hasAnyRole);
  const canViewTracking = canViewDocumentTracking(roles, user?.role, membership?.status);
  const canManageDeactivated = hasAnyRole(['company_admin', 'individual_admin']);

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
        'workspace-sidebar relative flex h-full min-h-0 shrink-0 flex-col self-stretch bg-doqyn-shell transition-[width,min-width] duration-200',
        className,
      )}
      data-testid="workspace-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <SidebarEdgeToggle collapsed={collapsed} onToggle={toggleCollapsed} />

      <header
        className={cn(
          'flex shrink-0 flex-col items-center',
          collapsed ? 'gap-2 px-2 pb-1.5 pt-3' : 'gap-3 px-3 pb-2 pt-4',
        )}
      >
        <div className={cn('w-full', collapsed && 'flex flex-col items-center gap-1.5')}>
          {/* A marca ocupa a linha inteira: não divide mais o lugar mais nobre
              da tela com um botão de recolher. */}
          <div className={cn('flex w-full items-center', collapsed ? 'justify-center' : 'px-1')}>
            <SidebarBrandLogo collapsed={collapsed} />
          </div>
        </div>

        {/* Fio separando a ação do índice: a linha de enviar pertence ao rail,
            mas não é um destino de navegação como as de baixo. */}
        <NewButtonMenu
          uploadContext={uploadContext}
          className={cn(collapsed ? 'w-10' : 'w-full border-b border-doqyn-border-subtle pb-2')}
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
            item={{
              labelKey: 'common:nav.biblioteca',
              path: '/biblioteca',
              icon: 'folder',
              end: true,
            }}
            collapsed={collapsed}
          />
          {libraryViewItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </SidebarSection>

        {!collapsed && <div className="mx-2 my-3 h-px bg-doqyn-border-subtle/40" aria-hidden />}

        <SidebarSection label={t('sidebar.administracao')} className="mt-5" collapsed={collapsed}>
          {adminNavItems.map((item) => (
            <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
          ))}
        </SidebarSection>

        {/* Dentro da coluna que rola, logo abaixo de Configurações: é a última
            linha do índice, não um rodapé grudado na base da janela. */}
        <SidebarUsage collapsed={collapsed} />
      </nav>
    </aside>
  );
}
