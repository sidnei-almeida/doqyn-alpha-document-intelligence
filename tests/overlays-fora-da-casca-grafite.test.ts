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

/**
 * Sobreposição declarada dentro do shell herda a paleta grafite no tema `standard`.
 *
 * `WorkspaceLayout` envolve tudo em `chrome-dark`, que reaplica os tokens escuros sob
 * `data-appearance='standard'`. O painel de conteúdo escapa porque `.workspace-canvas` redeclara a
 * paleta de papel para si; uma gaveta ou um overlay declarado ao lado dele, não — e nascia grafite
 * ao lado de um painel claro. O `Modal` nunca teve o problema porque sempre saiu em portal.
 */
const OVERLAYS_NO_SHELL = [
  'components/layout/WorkspaceSideDrawer.tsx',
  'features/upload/UploadQueueDrawer.tsx',
  'features/upload/drag-drop/UploadDropOverlay.tsx',
];

describe('sobreposições nascem fora da casca grafite', () => {
  it('o shell continua marcando a casca e o painel como camadas distintas', () => {
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('chrome-dark'));
    assert.ok(layout.includes('workspace-canvas'));
  });

  it('toda sobreposição declarada no shell sai em portal para o body', () => {
    for (const path of OVERLAYS_NO_SHELL) {
      const source = readSrc(path);
      assert.ok(source.includes("from 'react-dom'"), path);
      assert.ok(source.includes('createPortal('), path);
      assert.ok(source.includes('document.body'), path);
    }
  });

  it('a gaveta reancora o texto, porque no portal ele vem do body', () => {
    // `color` já foi resolvido para uma cor concreta acima e desce por herança: cada fronteira de
    // paleta precisa redizer o seu, senão o texto atravessa a troca de tema.
    const drawer = readSrc('components/layout/WorkspaceSideDrawer.tsx');
    assert.ok(drawer.includes('text-doqyn-text'));
  });

  it('a proposta da IA marca com fio de acento, não com bloco preenchido', () => {
    const picker = readSrc('features/upload/review/CategoryQuickPicker.tsx');
    const drawer = readSrc('features/upload/review/ReviewDrawer.tsx');
    // Régua de acento, não preenchimento: o âmbar de ponta a ponta virava uma superfície própria
    // e, no tema claro, gritava mais alto que o conteúdo que ele deveria apresentar.
    assert.ok(picker.includes('border-l-2 border-doqyn-primary'));
    assert.ok(!picker.includes('bg-doqyn-surface px-3 py-2'));
    assert.ok(drawer.includes('border-l-2 border-l-doqyn-warning'));
    // Nenhum âmbar preenchido sobrou na gaveta: os dois avisos viraram fio à esquerda também.
    assert.ok(!drawer.includes('bg-doqyn-warning-bg'));
  });
});
