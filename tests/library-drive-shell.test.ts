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

describe('shell drive-inspired do workspace', () => {
  it('WorkspaceLayout usa chrome externo e canvas interno arredondado', () => {
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('app-chrome'));
    assert.ok(layout.includes('app-shell'));
    assert.ok(layout.includes('workspace-canvas'));
    assert.ok(layout.includes('workspace-canvas-inner'));
    assert.equal(layout.includes('library-workspace-bg'), false);
    assert.equal(layout.includes('bg-doqyn-chrome'), false);
  });

  it('globals.css define shell edge-to-edge e canvas interno arredondado', () => {
    const globals = readSrc('styles/globals.css');
    for (const token of [
      '.app-chrome',
      '.app-shell',
      '.workspace-canvas',
      '.workspace-canvas-inner',
      '--radius-workspace',
    ]) {
      assert.ok(globals.includes(token), `${token} presente`);
    }

    const shellBlock = globals.match(/\.app-shell\s*\{[^}]+\}/s);
    assert.ok(shellBlock, '.app-shell block');
    assert.equal(shellBlock![0].includes('border-radius'), false);
    assert.equal(shellBlock![0].includes('box-shadow'), false);

    const chromeBlock = globals.match(/\.app-chrome\s*\{[^}]+\}/s);
    assert.ok(chromeBlock, '.app-chrome block');
    assert.equal(chromeBlock![0].includes('shell-inset'), false);
    assert.equal(chromeBlock![0].includes('padding'), false);

    assert.ok(globals.includes('border-radius: var(--radius-workspace)'));

    // Painel interno sem borda: superfície contínua "rebaixada" sob o chrome (estilo Drive).
    const canvasInnerBlock = globals.match(/\.workspace-canvas-inner\s*\{[^}]+\}/s);
    assert.ok(canvasInnerBlock, '.workspace-canvas-inner block');
    assert.equal(/\bborder:/.test(canvasInnerBlock![0]), false, '.workspace-canvas-inner sem borda');
    assert.ok(canvasInnerBlock![0].includes('border-radius: var(--radius-workspace)'));
    assert.ok(canvasInnerBlock![0].includes('background: var(--bg-canvas)'));
    assert.ok(canvasInnerBlock![0].includes('box-shadow: var(--shadow-workspace-panel)'));
    assert.ok(globals.includes('--shadow-workspace-panel'));
  });

  it('tokens definem superfícies chrome, shell e canvas distintas', () => {
    const tokens = readSrc('styles/tokens.css');
    for (const token of [
      '--bg-chrome',
      '--bg-shell',
      '--bg-canvas',
      '--radius-shell',
      '--radius-workspace',
      '--shadow-shell',
      '--shadow-workspace-panel',
    ]) {
      assert.ok(tokens.includes(token), `${token} presente`);
    }

    const darkCanvas = tokens.match(/\[data-theme='dark'\][\s\S]*?--bg-canvas:\s*(#[0-9a-f]+)/);
    const darkChrome = tokens.match(/\[data-theme='dark'\][\s\S]*?--bg-chrome:\s*(#[0-9a-f]+)/);
    assert.ok(darkCanvas && darkChrome);
    assert.notEqual(darkCanvas![1], darkChrome![1], 'canvas deve contrastar com chrome em dark');
    assert.ok(
      parseInt(darkCanvas![1].slice(1), 16) > parseInt(darkChrome![1].slice(1), 16),
      'painel de conteúdo deve ser mais claro que a base em dark (hierarquia Drive)',
    );

    // Base uniforme atrás de sidebar+topbar: shell (sidebar) segue o chrome nos dois temas
    const darkShell = tokens.match(/\[data-theme='dark'\][\s\S]*?--bg-shell:\s*var\(--bg-chrome\)/);
    assert.ok(darkShell, 'sidebar deve compartilhar o fundo base do chrome em dark');
    const lightChrome = tokens.match(
      /\[data-theme='light'\][\s\S]*?--bg-chrome:\s*var\(--color-surface\)/,
    );
    const lightShell = tokens.match(
      /\[data-theme='light'\][\s\S]*?--bg-shell:\s*var\(--color-surface\)/,
    );
    assert.ok(lightChrome && lightShell, 'sidebar e topbar devem usar --color-surface em light');

    const lightCanvas = tokens.match(
      /\[data-theme='light'\][\s\S]*?--bg-canvas:\s*var\(--color-background\)/,
    );
    const lightBackground = tokens.match(
      /\[data-theme='light'\][\s\S]*?--color-background:\s*#ffffff/,
    );
    assert.ok(lightCanvas);
    assert.ok(lightBackground);
  });

  it('sidebar e topbar sem bordas divisórias pesadas', () => {
    const sidebar = readSrc('components/layout/Sidebar.tsx');
    const topbar = readSrc('components/layout/WorkspaceTopBar.tsx');
    const globals = readSrc('styles/globals.css');
    assert.equal(sidebar.includes('border-r border-doqyn-border-subtle'), false);
    assert.equal(sidebar.includes('border-t border-doqyn-border-subtle'), false);
    assert.equal(topbar.includes('border-b border-doqyn-border-subtle'), false);
    assert.equal(topbar.includes('bg-doqyn-canvas'), false);
    assert.ok(sidebar.includes('bg-doqyn-shell'));
    assert.ok(globals.includes('.workspace-topbar'));
    assert.ok(globals.includes('background: var(--bg-chrome)'));
  });

  it('tipografia usa Google Sans Flex (display) e Roboto (corpo)', () => {
    const tokens = readSrc('styles/tokens.css');
    const tailwind = readFileSync(join(__dirname, '..', 'tailwind.config.js'), 'utf8');
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

    assert.ok(tokens.includes('Google Sans Flex'));
    assert.ok(tokens.includes('--font-body'));
    assert.ok(tailwind.includes("display: ['var(--font-display)']"));
    assert.ok(html.includes('family=Roboto'));
    assert.ok(html.includes('Google+Sans+Flex'));
  });

  it('listas do explorer usam miniatura pequena via DocumentFileThumbnail', () => {
    const row = readSrc('features/library/components/FileRow.tsx');
    const compact = readSrc('features/library/components/files/DocumentFileRow.tsx');
    assert.ok(row.includes('DocumentFileRowIcon'));
    assert.ok(compact.includes('DocumentFileThumbnail'));
    assert.ok(compact.includes('size="row"'));
  });

  it('pastas mantêm tile horizontal drive-folder-tile', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.ok(card.includes('drive-folder-tile'));
    assert.equal(card.includes('hover:border-doqyn-border-subtle'), false);
  });

  it('Biblioteca, upload e viewer preservados', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('ExplorerShell'));
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('ExplorerContextMenu'));
  });
});
