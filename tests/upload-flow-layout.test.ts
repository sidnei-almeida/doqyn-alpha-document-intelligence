import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const srcRoot = join(process.cwd(), 'src/features/document-send');

function read(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('upload flow layout', () => {
  it('DocumentSendPage unifica dropzone e progresso no UploadFlowPanel', () => {
    const page = readFileSync(
      join(process.cwd(), 'src/features/document-send/DocumentSendPage.tsx'),
      'utf8',
    );
    assert.match(page, /UploadFlowPanel/);
    assert.match(page, /UploadDropzoneArea/);
    assert.match(page, /variant="embedded"/);
    assert.ok(page.includes('<UploadProgressSummary'));
  });

  it('UploadDropzoneArea tem altura proporcional e chips de formato', () => {
    const source = read('components/UploadDropzoneArea.tsx');
    assert.match(source, /max-h-\[220px\]/);
    assert.match(source, /min-h-\[168px\]/);
    assert.match(source, /border-dashed/);
    assert.match(source, /hover:bg-doqyn-surface-hover/);
    assert.match(source, /Badge/);
    assert.match(source, /PDF/);
    assert.match(source, /por lote/);
  });

  it('UploadFlowPanel conecta conteúdo e progresso com borda superior', () => {
    const source = read('components/UploadFlowPanel.tsx');
    assert.match(source, /border-t border-doqyn-border/);
    assert.match(source, /centered/);
  });

  it('UploadProgressSummary suporta variante embedded', () => {
    const source = read('components/UploadProgressSummary.tsx');
    assert.match(source, /variant\?: 'standalone' \| 'embedded'/);
    assert.match(source, /eyebrow-text/);
  });
});
