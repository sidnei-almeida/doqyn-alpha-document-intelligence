import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  selectRangeIds,
  toggleIdInSet,
} from '../src/features/library/utils/librarySelectionUtils.ts';
import {
  buildLibraryBreadcrumbSegments,
  truncateBreadcrumbLabel,
} from '../src/features/library/utils/libraryItemActions.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
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
    assert.ok(hook.includes('interactFile'));
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
