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

describe('painel de detalhes da Biblioteca', () => {
  const drawer = () => readSrc('features/library/components/OptionalDetailsDrawer.tsx');

  it('ações respeitam permissões do documento', () => {
    const source = drawer();
    assert.ok(source.includes('canPreview'));
    assert.ok(source.includes('permissions?.canDownload'));
    assert.ok(source.includes('permissions?.canViewTracking'));
    assert.match(source, /\{canDownload && \(/);
    assert.match(source, /disabled=\{!canPreview\}/);
  });

  it('mostra metadados essenciais do arquivo', () => {
    const source = drawer();
    for (const field of ['Categoria', 'Proprietário', 'Atualizado', 'Versão']) {
      assert.ok(source.includes(field), `campo ${field} presente`);
    }
  });

  it('popover de contexto com link para Regras quando há categoria', () => {
    const source = readSrc('features/library/components/LibraryInfoPopover.tsx');
    assert.ok(source.includes('categoryName') || source.includes('/rules'));
    assert.ok(source.includes('/rules'));
    assert.ok(source.includes('documentCount') || source.includes('fileCount'));
  });

  it('tracking acessível a partir dos detalhes do arquivo', () => {
    const source = drawer();
    assert.ok(source.includes('/tracking?documentId='));
    assert.equal(source.includes('TrackingEventsTable'), false);
    assert.equal(source.includes('useTrackingEvents'), false);
  });

  it('drawer opcional só aparece sob demanda, não como coluna fixa', () => {
    const source = drawer();
    const shell = readSrc('components/layout/WorkspaceSideDrawer.tsx');
    assert.ok(shell.includes('max-w-xl'));
    assert.ok(source.includes('library-details-drawer'));
    assert.ok(source.includes('WorkspaceSideDrawer'));
    assert.ok(source.includes('Fechar painel de detalhes'));
    assert.equal(source.includes('lg:flex'), false);
    assert.equal(source.includes('library-details-panel'), false);
    assert.ok(shell.includes('fixed inset-0'));
  });
});
