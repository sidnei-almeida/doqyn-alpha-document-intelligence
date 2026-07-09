import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('sidebar DOQYN', () => {
  it('item ativo usa tokens índigo discretos da sidebar e pill radius', () => {
    const source = readSrc('components/layout/SidebarNavItem.tsx');
    assert.ok(source.includes('rounded-full'));
    assert.ok(source.includes('sidebar-nav-link--active'));
    assert.ok(source.includes('ICON_SIZE.nav'));
    assert.equal(source.includes('border-l-[3px]'), false);
    assert.equal(source.includes('shadow-action-glow'), false);
  });

  it('seção Administração usa headers discretos', () => {
    const section = readSrc('components/layout/SidebarSection.tsx');
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    assert.ok(section.includes('text-doqyn-subtle'));
    assert.ok(sidebar.includes('Administração'));
  });

  it('sidebar workspace: Biblioteca, + Novo, modo colapsável', () => {
    const source = readSrc('components/layout/Sidebar.tsx');
    const collapsed = readSrc('components/layout/useSidebarCollapsed.ts');
    assert.ok(source.includes('Biblioteca'));
    assert.ok(source.includes('/biblioteca'));
    assert.ok(source.includes('NewButtonMenu'));
    assert.ok(source.includes('useSidebarCollapsed'));
    assert.ok(source.includes('sidebar-collapse-toggle'));
    assert.ok(source.includes('chevron_left'));
    assert.equal(source.includes('explorer-icon-btn'), false);
    assert.ok(source.includes('data-collapsed'));
    assert.ok(collapsed.includes('--workspace-sidebar-width-collapsed'));
    assert.ok(collapsed.includes('localStorage'));
  });

  it('sidebar não renderiza seção Espaços nem rodapé de usuário', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    assert.equal(sidebar.includes('Espaços'), false);
    assert.equal(sidebar.includes('SidebarSpaceItem'), false);
    assert.equal(sidebar.includes('SidebarUserPanel'), false);
    assert.equal(sidebar.includes('sidebar-user-card'), false);
  });

  it('navegação principal inclui views da Biblioteca', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    assert.ok(sidebar.includes('NAV_ITEMS_LIBRARY_VIEWS'));
    for (const label of ['Compartilhados comigo', 'Recentes', 'Favoritos', 'Lixeira']) {
      assert.ok(sidebar.includes(label) || readSrc('lib/constants.ts').includes(label));
    }
  });

  it('tooltip lateral no modo colapsado via Tooltip temático', () => {
    const source = readSrc('components/layout/SidebarTooltip.tsx');
    assert.ok(source.includes('<Tooltip'));
    assert.ok(source.includes('placement="right"'));
  });

  it('modo colapsado não exibe scroll na navegação', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.ok(sidebar.includes('workspace-sidebar-nav'));
    assert.ok(sidebar.includes('mt-5'));
    assert.equal(sidebar.includes('mt-auto'), false);
    assert.ok(globals.includes(".workspace-sidebar[data-collapsed='true'] .workspace-sidebar-nav"));
  });

  it('ThemeToggle tem affordance de clique com hover e cursor pointer', () => {
    const source = readSrc('components/ui/ThemeToggle.tsx');
    assert.ok(source.includes('cursor-pointer'));
    assert.ok(source.includes('hover:bg-doqyn-surface-hover'));
    assert.ok(source.includes('h-icon-btn'));
  });
});

describe('header do usuário', () => {
  it('usuário aparece no topo direito com menu dropdown', () => {
    const topbar = readSrc('components/layout/WorkspaceTopBar.tsx');
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(topbar.includes('HeaderUserMenu'));
    assert.equal(topbar.includes('SidebarUserPanel'), false);
    assert.ok(menu.includes('header-user-menu'));
    assert.ok(menu.includes('header-user-menu-dropdown'));
    assert.ok(menu.includes('Sair'));
    assert.ok(menu.includes('ThemeToggle'));
  });
});
