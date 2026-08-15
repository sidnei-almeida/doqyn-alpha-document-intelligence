import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const DRAWER = 'src/features/upload/UploadQueueDrawer.tsx';
const PROVIDER = 'src/features/upload/UploadQueueProvider.tsx';

describe('fila de upload não fica presa na tela', () => {
  it('some sozinha depois que tudo foi salvo', () => {
    const source = read(DRAWER);

    assert.match(source, /AUTO_DISMISS_MS\s*=\s*\d+/, 'sem tempo de auto-dispensa declarado');
    assert.match(source, /setTimeout\(\(\) => setLeaving\(true\), AUTO_DISMISS_MS\)/);
    assert.match(source, /clearFinished\(\);/, 'a saída precisa terminar removendo os itens');
  });

  it('a saída do CSS dura o mesmo que o React espera para desmontar', () => {
    const drawer = read(DRAWER);
    const css = read('src/styles/globals.css');

    const ms = Number(/DISMISS_ANIMATION_MS\s*=\s*(\d+)/.exec(drawer)?.[1] ?? '0');
    const seconds = Number(
      /\.queue-drawer-leave\s*\{\s*animation:\s*queue-drawer-leave\s*([\d.]+)s/.exec(css)?.[1] ??
        '0',
    );

    assert.ok(ms > 0, 'sem DISMISS_ANIMATION_MS no componente');
    assert.ok(seconds > 0, 'sem animação queue-drawer-leave no CSS');
    assert.equal(
      Math.round(seconds * 1000),
      ms,
      'componente desmonta antes ou depois da animação — volta o corte seco',
    );
  });

  it('só dispensa quando todo item está salvo — pendência tem que continuar visível', () => {
    const source = read(DRAWER);

    assert.match(source, /items\.every\(isItemSavedInLibrary\)/);
    assert.match(source, /if \(!allSaved \|\| hovered \|\| leaving\) return;/);
  });

  it('pausa enquanto o ponteiro está em cima', () => {
    const source = read(DRAWER);

    assert.match(source, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
    assert.match(source, /onMouseLeave=\{\(\) => setHovered\(false\)\}/);
  });

  it('não repete no aviso o que a fila já diz', () => {
    const source = read(PROVIDER);

    assert.equal(
      source.includes('disponível na Biblioteca'),
      false,
      'aviso duplicava o status que a própria fila mostra no arquivo',
    );
  });
});
