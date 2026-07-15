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

describe('visualização dentro da pasta', () => {
  it('LibraryPage usa ExplorerPageHeader unificado', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('ExplorerPageHeader'));
    assert.ok(page.includes('explorer.isInsideFolder'));
  });

  it('ExplorerFolderFiles é lista explorador sem card administrativo', () => {
    const files = readSrc('features/library/components/ExplorerFolderFiles.tsx');
    assert.ok(files.includes('variant="explorer"'));
    assert.ok(files.includes('Modificado'));
    assert.equal(files.includes('border border-doqyn-border'), false);
  });

  it('FileRow explorer: ícone, hover, menu de contexto', () => {
    const row = readSrc('features/library/components/FileRow.tsx');
    assert.ok(row.includes("variant === 'explorer'"));
    assert.ok(row.includes('FileTypeIcon'));
    assert.ok(row.includes('more_horiz'));
    assert.ok(row.includes('onDoubleClick'));
    assert.equal(row.includes('TableRowActionsMenu'), false);
  });

  it('refresh e filtros ficam no ExplorerToolbarActions do header', () => {
    const actions = readSrc('features/library/components/ExplorerToolbarActions.tsx');
    assert.ok(actions.includes('WorkspaceRefreshButton'));
    assert.ok(actions.includes('FilterMenu'));
  });

  it('empty state da pasta é minimalista com upload', () => {
    const empty = readSrc('features/library/components/EmptyFolderState.tsx');
    assert.ok(empty.includes('Enviar documento'));
    assert.ok(empty.includes('library-empty-state'));
    assert.equal(empty.includes('EmptyState'), false);
  });

  it('OptionalDetailsDrawer minimalista com metadados essenciais', () => {
    const panel = readSrc('features/library/components/OptionalDetailsDrawer.tsx');
    // "Atualizado" migrou para o componente compartilhado com o viewer.
    const shared = readSrc('features/documents/components/DocumentDetailsShared.tsx');
    assert.ok(panel.includes('DocumentDetailsShared'));
    assert.ok(shared.includes('Atualizado'));
    assert.ok(panel.includes('Visualizar'));
    assert.ok(panel.includes('/tracking?documentId='));
    assert.equal(panel.includes('DetailsPanelTabs'), false);
  });
});
