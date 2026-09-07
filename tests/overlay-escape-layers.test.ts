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

describe('Escape e a pilha de camadas sobrepostas', () => {
  it('popover ancorado entra na pilha junto com modais e gavetas', () => {
    const hook = readSrc('components/ui/popover/useDismissOnOutside.ts');
    // Sem registrar, a gaveta de baixo segue se achando o topo e um Escape
    // fecha o calendário E a gaveta que o abriu.
    assert.ok(hook.includes('useOverlayLayer'));
    assert.ok(hook.includes('isTopLayer()'));
  });

  it('só o Escape consulta o topo — clique fora fecha em qualquer posição', () => {
    const hook = readSrc('components/ui/popover/useDismissOnOutside.ts');
    const pointerHandler = hook.slice(
      hook.indexOf('handlePointerDown'),
      hook.indexOf('handleKeyDown'),
    );
    // Se algo abriu por cima, clicar nesse algo deve mesmo dispensar o painel de baixo.
    assert.equal(pointerHandler.includes('isTopLayer'), false);
  });

  it('os ouvintes não trocam de identidade a cada render', () => {
    const hook = readSrc('components/ui/popover/useDismissOnOutside.ts');
    // `refs` chega como array literal novo por render e `onDismiss` é arrow inline:
    // sem estabilizar, o efeito reassina sempre e a tecla evapora quando outra
    // camada dispara um render no meio do disparo do evento.
    assert.ok(hook.includes('useStableCallback'));
    const deps = hook.slice(hook.lastIndexOf('}, ['), hook.lastIndexOf(']);'));
    assert.equal(deps.includes('refs'), false, 'refs não pode estar nas deps do efeito');
    assert.equal(deps.includes('onDismiss'), false, 'onDismiss não pode estar nas deps do efeito');
  });

  it('as camadas que escutam tecla global usam a mesma pilha', () => {
    for (const path of [
      'components/ui/Modal.tsx',
      'components/layout/WorkspaceSideDrawer.tsx',
      'features/tour/components/TourOverlay.tsx',
      'components/ui/popover/useDismissOnOutside.ts',
    ]) {
      assert.ok(readSrc(path).includes('useOverlayLayer'), `${path} deve entrar na pilha`);
    }
  });
});
