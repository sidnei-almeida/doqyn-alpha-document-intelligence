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

describe('z-index e popovers ancorados', () => {
  it('tokens.css define escala de camadas ordenada', () => {
    const tokens = readSrc('styles/tokens.css');
    for (const token of [
      '--z-local-elevated',
      '--z-sticky',
      '--z-dropdown',
      '--z-sidebar-flyout',
      '--z-tooltip',
      '--z-overlay',
      '--z-drawer',
      '--z-context-menu',
      '--z-modal',
      '--z-popover',
      '--z-confirm',
    ]) {
      assert.ok(tokens.includes(token), `falta ${token}`);
    }
  });

  it('AnchoredPopover usa portal e position fixed', () => {
    const popover = readSrc('components/ui/popover/AnchoredPopover.tsx');
    const hook = readSrc('components/ui/popover/useAnchoredFloating.ts');
    assert.ok(popover.includes('createPortal'));
    assert.ok(popover.includes('popover-layer'));
    assert.ok(hook.includes("position: 'fixed'"));
    assert.ok(hook.includes('panelRef'));
    assert.ok(hook.includes('fitsViewport'));
    assert.ok(hook.includes('resolvePopoverZIndex'));
  });

  it('popovers dentro de overlay (aria-modal) usam --z-popover acima do modal', () => {
    const util = readSrc('components/ui/popover/popoverZIndex.ts');
    assert.ok(util.includes('OVERLAY_HOST_SELECTOR'));
    assert.ok(util.includes('var(--z-popover)'));
  });

  it('popovers problemáticos migram para AnchoredPopover', () => {
    const components = [
      'features/library/components/ContextInfoButton.tsx',
      'components/layout/HeaderUserMenu.tsx',
      'features/library/components/NewButtonMenu.tsx',
      'components/ui/TableRowActionsMenu.tsx',
      'components/layout/SidebarUserPanel.tsx',
    ];
    for (const path of components) {
      const source = readSrc(path);
      assert.ok(source.includes('AnchoredPopover'), `${path} deve usar AnchoredPopover`);
      assert.equal(source.includes('absolute z-50'), false, `${path} não deve usar z-50 absolute`);
      assert.equal(source.includes('absolute z-[70]'), false, `${path} não deve usar z-[70] absolute`);
      assert.equal(source.includes('absolute z-30'), false, `${path} não deve usar z-30 absolute`);
    }
  });

  it('ContextInfoButton não fica preso no stacking local do canvas', () => {
    const source = readSrc('features/library/components/ContextInfoButton.tsx');
    assert.equal(source.includes('absolute right-0 top-full'), false);
    assert.ok(source.includes('placement="bottom-end"'));
  });

  it('workspace topbar e page header usam --z-sticky', () => {
    const globals = readSrc('styles/globals.css');
    const topbar = readSrc('components/layout/WorkspaceTopBar.tsx');
    assert.ok(globals.includes('.workspace-topbar'));
    assert.ok(globals.includes('z-index: var(--z-sticky)'));
    assert.equal(topbar.includes('z-20'), false);
  });
});
