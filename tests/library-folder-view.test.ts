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
    assert.ok(files.includes('.modificado'));
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

  it('empty state da pasta fala o vocabulário comum, sem pictograma', () => {
    const empty = readSrc('features/library/components/EmptyFolderState.tsx');
    assert.ok(empty.includes('.enviarDocumento'));
    assert.ok(empty.includes('library-empty-state'));
    /**
     * A proibição anterior — não usar `EmptyState` — nasceu quando ele era um bloco preenchido de
     * canto arredondado, e a pasta vazia queria o oposto disso. O `EmptyState` perdeu a moldura e
     * virou o padrão do app; manter a proibição hoje obrigaria esta tela a reescrever à mão o que
     * já existe, que foi exatamente o que aconteceu.
     */
    assert.ok(empty.includes('EmptyState'));
    // Sem pictograma: o resto do app abre o vazio com o fio curto, não com um desenho no meio.
    assert.equal(empty.includes('cloud_upload'), false);
    assert.equal(empty.includes('folder_open'), false);
  });

  it('OptionalDetailsDrawer minimalista com metadados essenciais', () => {
    const panel = readSrc('features/library/components/OptionalDetailsDrawer.tsx');
    // "Atualizado" migrou para o componente compartilhado com o viewer.
    const shared = readSrc('features/documents/components/DocumentDetailsShared.tsx');
    assert.ok(panel.includes('DocumentDetailsShared'));
    assert.ok(shared.includes('.atualizado'));
    assert.ok(panel.includes('.visualizar'));
    assert.ok(panel.includes('/tracking?documentId='));
    assert.equal(panel.includes('DetailsPanelTabs'), false);
  });
});
