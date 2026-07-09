import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  explorerSelectionReducer,
  initialExplorerSelectionState,
} from '../src/features/library/utils/explorerSelectionReducer.ts';
import type { DocumentListItem } from '../src/types/document-library.ts';
import type { LibraryFolder } from '../src/features/library/types/library.ts';
import {
  buildLibraryBreadcrumbSegments,
  truncateBreadcrumbLabel,
} from '../src/features/library/utils/libraryItemActions.ts';
import {
  selectRangeIds,
  toggleIdInSet,
} from '../src/features/library/utils/librarySelectionUtils.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function mockDoc(id: string): DocumentListItem {
  return {
    documentId: id,
    id,
    tenantId: 't1',
    currentFileName: `${id}.pdf`,
    status: 'ready',
    displayName: id,
    documentType: 'pdf',
    version: 1,
    ownerUserId: 'u1',
  };
}

function mockFolder(id: string): LibraryFolder {
  return { id, name: id, documentCount: 0 };
}

describe('seleção múltipla da Biblioteca', () => {
  it('selectRangeIds retorna intervalo inclusivo na ordem da lista', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    assert.deepEqual(selectRangeIds(ids, 'b', 'd'), ['b', 'c', 'd']);
    assert.deepEqual(selectRangeIds(ids, 'd', 'b'), ['b', 'c', 'd']);
  });

  it('toggleIdInSet adiciona e remove ids', () => {
    const first = toggleIdInSet(new Set(['a']), 'b');
    assert.deepEqual([...first], ['a', 'b']);
    const second = toggleIdInSet(first, 'a');
    assert.deepEqual([...second], ['b']);
  });

  it('hook de seleção usa reducer com modificadores', () => {
    const reducer = readSrc('features/library/utils/explorerSelectionReducer.ts');
    const hook = readSrc('features/library/hooks/useExplorerSelection.ts');
    assert.ok(reducer.includes('shiftKey'));
    assert.ok(reducer.includes('metaKey'));
    assert.ok(reducer.includes('ctrlKey'));
    assert.ok(reducer.includes('selectRangeIds'));
    assert.ok(reducer.includes('deselectIdFromSet'));
    assert.ok(hook.includes('interactFile'));
  });

  it('clique simples em arquivo já selecionado desseleciona', () => {
    const doc = mockDoc('a');
    const orderedIds = ['a', 'b', 'c'];
    const selected = explorerSelectionReducer(initialExplorerSelectionState, {
      type: 'select_file',
      payload: { document: doc, orderedIds },
    });
    assert.ok(selected.selectedFileIds.has('a'));

    const deselected = explorerSelectionReducer(selected, {
      type: 'select_file',
      payload: { document: doc, orderedIds },
    });
    assert.equal(deselected.selectedFileIds.size, 0);
    assert.equal(deselected.focus, null);
  });

  it('clique simples em um de vários selecionados remove só esse item', () => {
    const orderedIds = ['a', 'b', 'c'];
    const multi = explorerSelectionReducer(initialExplorerSelectionState, {
      type: 'marquee_select',
      payload: { fileIds: ['a', 'b', 'c'], folderIds: [], additive: false },
    });

    const next = explorerSelectionReducer(multi, {
      type: 'select_file',
      payload: { document: mockDoc('b'), orderedIds },
    });
    assert.deepEqual([...next.selectedFileIds].sort(), ['a', 'c']);
  });

  it('Ctrl/Cmd+clique continua alternando seleção', () => {
    const orderedIds = ['a', 'b'];
    const docA = mockDoc('a');
    const selected = explorerSelectionReducer(initialExplorerSelectionState, {
      type: 'select_file',
      payload: { document: docA, orderedIds },
    });

    const toggledOff = explorerSelectionReducer(selected, {
      type: 'select_file',
      payload: { document: docA, orderedIds, modifiers: { metaKey: true } },
    });
    assert.equal(toggledOff.selectedFileIds.size, 0);

    const toggledOn = explorerSelectionReducer(toggledOff, {
      type: 'select_file',
      payload: { document: mockDoc('b'), orderedIds, modifiers: { ctrlKey: true } },
    });
    assert.deepEqual([...toggledOn.selectedFileIds], ['b']);
  });

  it('Shift+clique mantém seleção por intervalo', () => {
    const orderedIds = ['a', 'b', 'c', 'd'];
    const anchored = explorerSelectionReducer(initialExplorerSelectionState, {
      type: 'select_file',
      payload: { document: mockDoc('a'), orderedIds },
    });

    const ranged = explorerSelectionReducer(anchored, {
      type: 'select_file',
      payload: { document: mockDoc('c'), orderedIds, modifiers: { shiftKey: true } },
    });
    assert.deepEqual([...ranged.selectedFileIds], ['a', 'b', 'c']);
  });

  it('clique simples em pasta já selecionada desseleciona', () => {
    const folder = mockFolder('f1');
    const orderedIds = ['f1', 'f2'];
    const selected = explorerSelectionReducer(initialExplorerSelectionState, {
      type: 'select_folder',
      payload: { folder, orderedIds },
    });

    const deselected = explorerSelectionReducer(selected, {
      type: 'select_folder',
      payload: { folder, orderedIds },
    });
    assert.equal(deselected.selectedFolderIds.size, 0);
  });

  it('context menu em item não selecionado seleciona antes de abrir', () => {
    const context = readSrc('features/library/context/ExplorerActionsContext.tsx');
    assert.ok(context.includes('if (!selectedFileIds.has(doc.documentId))'));
    assert.ok(context.includes('selectFile(doc)'));
  });

  it('atalhos ESC e clique em área vazia limpam seleção', () => {
    const shortcuts = readSrc('features/library/hooks/useExplorerSelectionShortcuts.ts');
    const page = readSrc('features/library/LibraryPage.tsx');
    const dropzone = readSrc('features/library/components/LibraryContentDropZone.tsx');
    assert.ok(shortcuts.includes("event.key !== 'Escape'"));
    assert.ok(page.includes('useExplorerSelectionShortcuts'));
    assert.ok(dropzone.includes('onBackgroundClick'));
  });

  it('cards usam ExplorerActionsContext em vez de prop drilling', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(card.includes('useExplorerFileActions'));
    assert.ok(page.includes('ExplorerActionsProvider'));
    assert.equal(page.includes('fileActions'), false);
  });
});

describe('seleção premium — grid e lista', () => {
  it('card não usa HoverCheckbox nem input nativo fixo', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.equal(card.includes('HoverCheckbox'), false);
    assert.equal(card.includes('type="checkbox"'), false);
    assert.equal(card.includes('type="radio"'), false);
    assert.ok(card.includes('ExplorerSelectionIndicator'));
    assert.ok(card.includes('visible={isSelected}'));
  });

  it('lista não usa HoverCheckbox', () => {
    const row = readSrc('features/library/components/FileRow.tsx');
    assert.equal(row.includes('HoverCheckbox'), false);
    assert.equal(row.includes('type="checkbox"'), false);
    assert.ok(row.includes('aria-selected={isSelected}'));
    assert.ok(row.includes('explorer-item-selected'));
  });

  it('documento selecionado usa aria-selected e classe visual', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.ok(card.includes('aria-selected={isSelected}'));
    assert.ok(card.includes('explorer-item-selected'));
  });

  it('teclado: Enter abre, Space alterna seleção', () => {
    const keyboard = readSrc('features/library/utils/explorerItemKeyboard.ts');
    assert.ok(keyboard.includes("event.key === 'Enter'"));
    assert.ok(keyboard.includes("event.key === ' '"));
    assert.ok(keyboard.includes('onToggleSelect'));
  });

  it('hover mostra ações rápidas, não checkbox', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const quick = readSrc('features/library/components/ExplorerFileQuickActions.tsx');
    assert.ok(card.includes('ExplorerFileQuickActions'));
    assert.ok(quick.includes('explorer-quick-actions'));
    assert.equal(quick.includes('checkbox'), false);
  });
});

describe('toolbar de seleção contextual', () => {
  it('SelectionToolbar aparece com contador e ações', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const toolbar = readSrc('features/library/components/LibraryToolbar.tsx');
    const bulk = readSrc('features/library/components/BulkSelectionToolbar.tsx');
    assert.ok(page.includes('selectedCount > 0'));
    assert.ok(toolbar.includes('BulkSelectionToolbar'));
    assert.ok(bulk.includes('explorer-selection-toolbar'));
    assert.ok(bulk.includes('item selecionado'));
    assert.ok(bulk.includes('Visualizar'));
    assert.ok(bulk.includes('Baixar'));
    assert.ok(bulk.includes('Excluir'));
  });
});

describe('breadcrumbs da Biblioteca', () => {
  it('trunca rótulos longos no meio', () => {
    const long = 'Compartilhados comigo em uma organização muito grande';
    const truncated = truncateBreadcrumbLabel(long, 24);
    assert.ok(truncated.includes('…'));
    assert.ok(truncated.length <= 24);
  });

  it('monta segmentos de coleção e espaço', () => {
    const segments = buildLibraryBreadcrumbSegments({
      collectionLabel: 'Compartilhados comigo',
      spaceName: undefined,
      isRootCollection: false,
    });
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.label, 'Compartilhados comigo');
  });
});
