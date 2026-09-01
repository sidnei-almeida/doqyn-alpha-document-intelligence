import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { TOUR_STEPS, visibleTourSteps } from '../src/features/tour/tourSteps.js';
import type { TourAccess } from '../src/features/tour/tourTypes.js';

const root = new URL('../', import.meta.url);

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

/**
 * Onde cada seletor do roteiro deveria estar escrito no app.
 *
 * O tour aponta para elementos que ele não desenha. Renomear um `data-testid`
 * ou uma classe de layout em outro lugar do código não quebra compilação nem
 * teste nenhum — só faz o passo abrir sem holofote, em produção, e ninguém
 * fica sabendo. Este mapa é o contrato que faltava.
 */
const SELECTOR_SOURCES: Record<string, string[]> = {
  '[data-tour="nav:/biblioteca"]': ['src/components/layout/SidebarNavItem.tsx'],
  '[data-tour="nav:/biblioteca/assinaturas"]': ['src/components/layout/SidebarNavItem.tsx'],
  '[data-tour="nav:/pedidos"]': ['src/components/layout/SidebarNavItem.tsx'],
  '[data-tour="nav:/audit"]': ['src/components/layout/SidebarNavItem.tsx'],
  '[data-tour="new-button"]': ['src/features/library/components/NewButtonMenu.tsx'],
  '[data-tour="help"]': ['src/components/layout/HelpMenu.tsx'],
  '[data-testid="explorer-folder-grid"]': ['src/features/library/components/ExplorerFolderGrid.tsx'],
  '[data-testid="explorer-folder-grid-empty"]': [
    'src/features/library/components/ExplorerFolderGrid.tsx',
  ],
  '[data-testid="explorer-root-home"]': ['src/features/library/components/ExplorerRootHome.tsx'],
  '.page-shell__body': ['src/components/layout/PageShell.tsx'],
  '.matrix-grid': ['src/features/matrix/components/GroupAccessMatrixTable.tsx'],
  '#upload': ['src/features/settings/components/sections/UploadAiSettingsSection.tsx'],
};

/** O trecho literal que prova que o seletor existe do outro lado. */
function literalFor(selector: string): string {
  const dataAttr = /^\[data-(tour|testid)="(.+)"\]$/.exec(selector);
  if (dataAttr) {
    const [, kind, value] = dataAttr;
    // `nav:/pedidos` é montado por template no SidebarNavItem; ali basta provar
    // que o atributo nasce do próprio caminho do item.
    if (value!.startsWith('nav:')) return 'data-tour={`nav:${item.path}`}';
    return `data-${kind}="${value}"`;
  }
  if (selector.startsWith('#')) return `id="${selector.slice(1)}"`;
  return selector.slice(1);
}

const fullAccess: TourAccess = {
  canManageUsers: true,
  canAccessRules: true,
  governsOrganization: true,
};

const plainAccess: TourAccess = {
  canManageUsers: false,
  canAccessRules: false,
  governsOrganization: false,
};

describe('tour do produto', () => {
  it('todo alvo do roteiro existe em algum lugar do app', () => {
    for (const step of TOUR_STEPS) {
      for (const selector of step.target ?? []) {
        const sources = SELECTOR_SOURCES[selector];
        assert.ok(sources, `seletor sem origem declarada no teste: ${selector} (passo ${step.id})`);

        const literal = literalFor(selector);
        const found = sources.some((source) => read(source).includes(literal));
        assert.ok(found, `${step.id}: ${selector} não aparece em ${sources.join(', ')}`);
      }
    }
  });

  it('cada passo tem id único — o id é a chave que reinicia a busca do alvo', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('quem não administra não recebe passo que fala de tela fechada', () => {
    const restricted = visibleTourSteps(plainAccess).map((step) => step.id);

    assert.ok(!restricted.includes('usuarios'));
    assert.ok(!restricted.includes('regras'));
    assert.ok(!restricted.includes('ia'));
    // O essencial continua de pé: sem estes o tour não explica nada.
    assert.ok(restricted.includes('biblioteca'));
    assert.ok(restricted.includes('enviar'));
    assert.ok(restricted.includes('ajuda'));
  });

  it('o administrador recebe o roteiro inteiro', () => {
    assert.equal(visibleTourSteps(fullAccess).length, TOUR_STEPS.length);
  });

  it('o roteiro começa sem alvo e termina no próprio "?"', () => {
    const steps = visibleTourSteps(fullAccess);
    assert.equal(steps[0]!.target, undefined);
    assert.deepEqual(steps.at(-1)!.target, ['[data-tour="help"]']);
  });

  it('toda rota do roteiro é rota registrada do workspace', () => {
    const routes = read('src/app/routes.tsx');
    for (const step of TOUR_STEPS) {
      if (!step.route) continue;
      const [pathname] = step.route.split('?');
      assert.ok(
        routes.includes(`path: '${pathname}'`),
        `${step.id}: ${pathname} não está em routes.tsx`,
      );
    }
  });
});
