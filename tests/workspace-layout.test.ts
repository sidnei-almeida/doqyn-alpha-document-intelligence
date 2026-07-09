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

describe('layout do workspace', () => {
  it('WorkspaceLayout renderiza sidebar, topbar e conteúdo', () => {
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('<Sidebar'));
    assert.ok(layout.includes('WorkspaceTopBar'));
    assert.ok(layout.includes('<Outlet'));
  });

  it('WorkspaceLayout provê fila de upload, overlay e revisão globais', () => {
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('UploadQueueProvider'));
    assert.ok(layout.includes('UploadQueueDrawer'));
    assert.ok(layout.includes('UploadDropOverlay'));
    assert.ok(layout.includes('ReviewDrawer'));
  });

  it('TopBar tem busca global com placeholder e atalho de teclado', () => {
    const topbar = readSrc('components/layout/WorkspaceTopBar.tsx');
    const search = readSrc('components/layout/GlobalSearchCommand.tsx');
    assert.ok(topbar.includes('GlobalSearchCommand'));
    assert.ok(search.includes('Buscar documentos'));
    assert.ok(search.includes('keyboard_command_key'));
    assert.ok(search.includes('Ctrl'));
    assert.ok(search.includes('isMacPlatform'));
    assert.ok(search.includes('metaKey') && search.includes('ctrlKey'));
    assert.ok(search.includes("navigate(`/biblioteca"));
  });

  it('TopBar reaproveita sessão atual (usuário e tenant)', () => {
    const topbar = readSrc('components/layout/WorkspaceTopBar.tsx');
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(menu.includes('useAuth'));
    assert.ok(menu.includes('tenant'));
    assert.ok(topbar.includes('HeaderUserMenu'));
  });

  it('sidebar tem + Novo sem seção Espaços duplicada', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    const newButton = readSrc('features/library/components/NewButtonMenu.tsx');
    assert.ok(sidebar.includes('NewButtonMenu'));
    assert.equal(sidebar.includes('Espaços'), false);
    assert.equal(sidebar.includes('SidebarSpaceItem'), false);
    assert.ok(sidebar.includes('useDocumentCategories'));
    assert.ok(newButton.includes('sidebar-new-button'));
    assert.ok(newButton.includes('sidebar-new-menu'));
  });

  it('+ Novo tem upload de arquivo e pasta funcional; nova pasta permanece futura', () => {
    const newButton = readSrc('features/library/components/NewButtonMenu.tsx');
    assert.ok(newButton.includes('Upload de arquivo'));
    assert.ok(newButton.includes('Upload de pasta'));
    assert.ok(newButton.includes('startUploadFromFiles'));
    assert.ok(newButton.includes('Nova pasta'));
    assert.ok(newButton.includes('Em breve'));
    assert.ok(newButton.includes('/solicitar-acesso'));
    assert.equal(newButton.includes('localStorage'), false);
  });

  it('sidebar não tem mais Envio de Documentos como navegação', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    assert.equal(sidebar.includes('Envio de Documentos'), false);
    assert.equal(sidebar.includes("'/upload'"), false);
  });

  it('views da Biblioteca usam navegação real (não Coming Soon)', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    const constants = readSrc('lib/constants.ts');
    assert.ok(sidebar.includes('NAV_ITEMS_LIBRARY_VIEWS'));
    assert.ok(sidebar.includes('SidebarNavItem'));
    assert.equal(sidebar.includes('ComingSoonNavItem'), false);
    for (const label of ['Compartilhados comigo', 'Recentes', 'Favoritos', 'Lixeira']) {
      assert.ok(constants.includes(label), `${label} presente`);
    }
  });

  it('tokens do workspace estão definidos', () => {
    const tokens = readSrc('styles/tokens.css');
    for (const token of [
      '--gradient-action',
      '--workspace-sidebar-width',
      '--workspace-sidebar-width-expanded',
      '--workspace-sidebar-width-collapsed',
      '--workspace-topbar-height',
      '--library-details-width',
      '--folder-gradient-juridico',
      '--bg-chrome',
      '--bg-shell',
      '--radius-shell',
      '--radius-workspace',
    ]) {
      assert.ok(tokens.includes(token), `token ${token} presente`);
    }
  });
});
