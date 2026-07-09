import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  clientPointToLocal,
  collectSelectableItemsFromContainer,
  exceedsDragThreshold,
  findIntersectingSelectableIds,
  isMarqueePointerType,
  localRectToClient,
  mergeMarqueeSelection,
  normalizeSelectionRect,
  shouldBlockMarqueeStart,
  MARQUEE_DRAG_THRESHOLD_PX,
} from '../src/features/library/utils/marqueeSelectionUtils.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('marquee selection — utilitários', () => {
  it('converte client point para coordenadas locais do container', () => {
    const container = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        right: 500,
        bottom: 400,
        width: 400,
        height: 350,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }),
      scrollLeft: 20,
      scrollTop: 10,
    };

    const local = clientPointToLocal(150, 80, container);
    assert.equal(local.x, 70);
    assert.equal(local.y, 40);
  });

  it('converte retângulo local para viewport para hit test', () => {
    const container = {
      getBoundingClientRect: () => ({
        left: 80,
        top: 40,
        right: 480,
        bottom: 440,
        width: 400,
        height: 400,
        x: 80,
        y: 40,
        toJSON: () => ({}),
      }),
      scrollLeft: 15,
      scrollTop: 5,
    };

    const client = localRectToClient({ left: 10, top: 20, width: 100, height: 50 }, container);
    assert.equal(client.left, 75);
    assert.equal(client.top, 55);
    assert.equal(client.width, 100);
    assert.equal(client.height, 50);
  });

  it('normaliza retângulo ao arrastar para esquerda/cima', () => {
    const rect = normalizeSelectionRect({ x: 120, y: 80 }, { x: 20, y: 30 });
    assert.equal(rect.left, 20);
    assert.equal(rect.top, 30);
    assert.equal(rect.width, 100);
    assert.equal(rect.height, 50);
  });

  it('threshold mínimo evita iniciar drag em micro movimento', () => {
    assert.equal(exceedsDragThreshold({ x: 0, y: 0 }, { x: 2, y: 2 }), false);
    assert.equal(
      exceedsDragThreshold({ x: 0, y: 0 }, { x: MARQUEE_DRAG_THRESHOLD_PX, y: 0 }),
      true,
    );
  });

  it('merge sem Ctrl substitui seleção pelos itens intersectados', () => {
    const merged = mergeMarqueeSelection(
      { fileIds: new Set(['a', 'b']), folderIds: new Set(['f1']) },
      { fileIds: ['c'], folderIds: ['f2'] },
      false,
    );
    assert.deepEqual(merged.fileIds, ['c']);
    assert.deepEqual(merged.folderIds, ['f2']);
  });

  it('merge com Ctrl adiciona itens intersectados à seleção existente', () => {
    const merged = mergeMarqueeSelection(
      { fileIds: new Set(['a']), folderIds: new Set(['f1']) },
      { fileIds: ['b', 'c'], folderIds: ['f2'] },
      true,
    );
    assert.deepEqual([...merged.fileIds].sort(), ['a', 'b', 'c']);
    assert.deepEqual([...merged.folderIds].sort(), ['f1', 'f2']);
  });

  it('bloqueia início em controles interativos e data-no-marquee-select', () => {
    const withButton = {
      closest: (selector: string) => (selector.includes('button') ? {} : null),
    } as unknown as HTMLElement;
    assert.equal(shouldBlockMarqueeStart(withButton), true);

    const blocked = {
      closest: (selector: string) => (selector === '[data-no-marquee-select]' ? {} : null),
    } as unknown as HTMLElement;
    assert.equal(shouldBlockMarqueeStart(blocked), true);

    const explorerItem = {
      closest: (selector: string) => (selector === '[data-explorer-item]' ? {} : null),
    } as unknown as HTMLElement;
    assert.equal(shouldBlockMarqueeStart(explorerItem), true);
  });

  it('só ativa marquee para mouse e pen', () => {
    assert.equal(isMarqueePointerType('mouse'), true);
    assert.equal(isMarqueePointerType('pen'), true);
    assert.equal(isMarqueePointerType('touch'), false);
  });

  it('coleta arquivos e pastas via data-explorer-item-id', () => {
    const container = {
      querySelectorAll: (selector: string) => {
        assert.equal(selector, '[data-explorer-item-id]');
        return [
          { dataset: { explorerItemId: 'doc-1', explorerItem: 'file' } },
          { dataset: { explorerItemId: 'folder-1', explorerItem: 'folder' } },
        ];
      },
    } as unknown as HTMLElement;

    const items = collectSelectableItemsFromContainer(container);
    assert.equal(items.size, 2);
    assert.ok(items.has('file:doc-1'));
    assert.ok(items.has('folder:folder-1'));
  });

  it('detecta interseção entre retângulo e itens registrados', () => {
    const element = {
      isConnected: true,
      dataset: { explorerItemId: 'doc-1' },
      getBoundingClientRect: () => ({
        left: 10,
        top: 10,
        right: 50,
        bottom: 50,
        width: 40,
        height: 40,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      }),
    } as HTMLElement;

    const items = new Map([
      ['file:doc-1', { kind: 'file' as const, element }],
      ['folder:folder-1', { kind: 'folder' as const, element: { ...element, dataset: { explorerItemId: 'folder-1' } } as HTMLElement }],
    ]);

    const rect = { left: 0, top: 0, width: 30, height: 30 };
    const result = findIntersectingSelectableIds(rect, items);
    assert.deepEqual(result.fileIds, ['doc-1']);
    assert.deepEqual(result.folderIds, ['folder-1']);
  });
});

describe('marquee selection — integração frontend', () => {
  it('provider, overlay e registry estão no explorer', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const provider = readSrc('features/library/context/MarqueeSelectionProvider.tsx');
    const overlay = readSrc('features/library/components/MarqueeSelectionOverlay.tsx');
    const reducer = readSrc('features/library/utils/explorerSelectionReducer.ts');

    assert.ok(page.includes('MarqueeSelectionProvider'));
    assert.ok(page.includes('applyMarqueeSelection'));
    assert.ok(provider.includes('shouldBlockMarqueeStart'));
    assert.ok(provider.includes('MarqueeSelectionOverlay'));
    assert.ok(overlay.includes('data-testid="explorer-marquee-selection"'));
    assert.ok(overlay.includes('absolute'));
    assert.equal(overlay.includes('fixed'), false);
    assert.ok(provider.includes('clientPointToLocal'));
    assert.ok(provider.includes('localRectToClient'));
    assert.ok(reducer.includes("type: 'marquee_select'"));
    assert.ok(reducer.includes("type: 'restore_selection'"));
  });

  it('cards e linhas registram itens selecionáveis', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const row = readSrc('features/library/components/files/DocumentFileRow.tsx');
    const fileRow = readSrc('features/library/components/FileRow.tsx');
    const folder = readSrc('features/library/components/ExplorerFolderCard.tsx');
    const dropZone = readSrc('features/library/components/LibraryContentDropZone.tsx');
    const provider = readSrc('features/library/context/MarqueeSelectionProvider.tsx');

    assert.ok(card.includes('useSelectableItemRef'));
    assert.ok(card.includes('data-explorer-item-id'));
    assert.ok(row.includes('useSelectableItemRef'));
    assert.ok(row.includes('data-explorer-item-id'));
    assert.ok(fileRow.includes('useSelectableItemRef'));
    assert.ok(fileRow.includes('data-explorer-item-id'));
    assert.ok(folder.includes("useSelectableItemRef(folder.id, 'folder')"));
    assert.ok(folder.includes('data-explorer-item-id'));
    assert.ok(dropZone.includes('flex flex-col'));
    assert.ok(provider.includes('onPointerDownCapture'));
    assert.ok(provider.includes('onClickCapture'));
    assert.ok(provider.includes('suppressClickRef'));
    assert.ok(provider.includes('min-h-full'));
  });

  it('suprime click sintético após commit do marquee', () => {
    const provider = readSrc('features/library/context/MarqueeSelectionProvider.tsx');
    const dropZone = readSrc('features/library/components/LibraryContentDropZone.tsx');
    const page = readSrc('features/library/LibraryPage.tsx');

    assert.ok(provider.includes('committedMarquee'));
    assert.ok(provider.includes('event.stopPropagation()'));
    assert.ok(dropZone.includes('onBackgroundClick'));
    assert.ok(page.includes('marqueeDragging'));
  });

  it('ações rápidas e favorito não iniciam marquee', () => {
    const quick = readSrc('features/library/components/ExplorerFileQuickActions.tsx');
    const menu = readSrc('features/library/components/files/DocumentItemMenu.tsx');
    assert.ok(quick.includes('data-no-marquee-select'));
    assert.ok(menu.includes('data-no-marquee-select'));
  });

  it('tokens visuais do retângulo estão definidos', () => {
    const tokens = readFileSync(join(srcRoot, 'styles', 'tokens.css'), 'utf8');
    const globals = readFileSync(join(srcRoot, 'styles', 'globals.css'), 'utf8');
    assert.ok(tokens.includes('--marquee-bg'));
    assert.ok(tokens.includes('--marquee-border'));
    assert.ok(globals.includes('.explorer-marquee-selection'));
  });
});
