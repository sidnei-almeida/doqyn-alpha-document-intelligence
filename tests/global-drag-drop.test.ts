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

describe('drag and drop global de upload', () => {
  it('overlay só renderiza durante o drag', () => {
    const overlay = readSrc('features/upload/drag-drop/UploadDropOverlay.tsx');
    assert.ok(overlay.includes('if (!isDragging) return null'));
    assert.ok(overlay.includes('Solte para enviar ao DOQYN'));
    assert.ok(overlay.includes('A IA analisará, classificará e preparará o documento para revisão'));
  });

  it('hook escuta eventos de drag na janela inteira e entrega os arquivos', () => {
    const hook = readSrc('features/upload/drag-drop/useGlobalDragDrop.ts');
    for (const event of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      assert.ok(hook.includes(`'${event}'`), `escuta ${event}`);
    }
    assert.ok(hook.includes('dragDepthRef'));
    assert.ok(hook.includes('dataTransfer'));
    assert.ok(hook.includes('removeEventListener'));
  });

  it('só reage a drags que contêm arquivos', () => {
    const hook = readSrc('features/upload/drag-drop/useGlobalDragDrop.ts');
    assert.ok(hook.includes("includes('Files')"));
  });

  it('soltar arquivos alimenta a mesma fila do botão + Novo', () => {
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('useGlobalDragDrop'));
    assert.ok(layout.includes('startUploadFromFiles'));
    assert.ok(layout.includes('UploadDropOverlay'));
  });

  it('Biblioteca não tem dropzone fixa — upload é overlay ou + Novo', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.equal(page.includes('UploadDropzoneArea'), false);
    assert.equal(page.includes('border-dashed'), false);
  });
});
