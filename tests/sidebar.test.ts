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
    // O botão de colapsar saiu para `SidebarEdgeToggle`, que vive na borda entre sidebar e
    // conteúdo — a sidebar passou a montá-lo em vez de desenhá-lo.
    assert.ok(source.includes('SidebarEdgeToggle'));
    assert.ok(
      readSrc('components/layout/SidebarEdgeToggle.tsx').includes('sidebar-collapse-toggle'),
    );
    // O chevron flutuante ao lado da marca foi removido de propósito: o divisor entre barra e
    // conteúdo virou o próprio controle, e reage no hover como o resto do sistema.
    assert.equal(source.includes('chevron_left'), false);
    const edge = readSrc('components/layout/SidebarEdgeToggle.tsx');
    assert.ok(edge.includes('cursor-col-resize'));
    assert.ok(edge.includes('group-hover:bg-doqyn-accent-active'));
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
    for (const label of [
      'Compartilhados comigo',
      'Para assinar',
      'Recentes',
      'Favoritos',
      'Lixeira',
    ]) {
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
    // O hover deixou de preencher: no sistema novo o realce é de cor, não de fundo — bloco
    // preenchido ficou reservado à ação principal da tela.
    assert.ok(source.includes('hover:text-doqyn-text'));
    assert.equal(source.includes('hover:bg-doqyn-surface-hover'), false);
    assert.ok(source.includes('h-9 w-9'));
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
    // O tema saiu do menu do usuário e virou controle da própria barra: é preferência de
    // visualização, não ação de conta.
    assert.ok(topbar.includes('ThemeToggle'));
  });
});
