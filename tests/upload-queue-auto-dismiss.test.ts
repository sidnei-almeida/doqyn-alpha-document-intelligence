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
    assert.match(source, /setTimeout\(clearFinished/, 'o tempo precisa chamar clearFinished');
  });

  it('só dispensa quando todo item está salvo — pendência tem que continuar visível', () => {
    const source = read(DRAWER);

    assert.match(source, /items\.every\(isItemSavedInLibrary\)/);
    assert.match(source, /if \(!allSaved \|\| hovered\) return;/);
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
