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

describe('layout de altura total nas páginas internas', () => {
  it('WorkspaceLayout usa shell flex com altura fixa na viewport e main content expansível', () => {
    const source = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(source.includes('app-shell'));
    assert.ok(source.includes('h-dvh'));
    assert.ok(source.includes('overflow-hidden'));
    assert.ok(source.includes('main-content'));
    assert.ok(source.includes('page-outlet'));
    assert.ok(source.includes('flex-1'));
    assert.equal(source.includes('h-auto w-full'), false);
  });

  it('AppLayout delega para o WorkspaceLayout', () => {
    const source = readSrc('components/layout/AppLayout.tsx');
    assert.ok(source.includes('WorkspaceLayout'));
  });

  it('PageShell define header fixo e body flexível', () => {
    const source = readSrc('components/layout/PageShell.tsx');
    assert.ok(source.includes('page-shell'));
    assert.ok(source.includes('page-shell__header'));
    assert.ok(source.includes('page-shell__body'));
    assert.ok(source.includes('flex-1'));
    assert.ok(source.includes('min-h-0'));
  });

  it('globals.css define min-height em html, body e #root', () => {
    const source = readSrc('styles/globals.css');
    assert.ok(source.includes('html'));
    assert.ok(source.includes('min-height: 100%'));
    assert.ok(source.includes('min-height: 100dvh'));
    assert.ok(source.includes('#root'));
  });

  it('DashboardPage usa PageShell e grid principal expansível', () => {
    const source = readSrc('features/documents/DashboardPage.tsx');
    assert.ok(source.includes('PageShell'));
    assert.ok(source.includes('overview-main-grid'));
    assert.ok(source.includes('flex-1'));
  });

  it('RulesPage estica o mapa de governança', () => {
    const source = readSrc('features/rules/RulesPage.tsx');
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('PageShell'));
    assert.ok(source.includes('GovernanceMapCanvas'));
    assert.ok(source.includes('flex-1'));
    assert.ok(canvas.includes('rules-map'));
    assert.ok(canvas.includes('flex-1'));
    assert.ok(canvas.includes('GovernanceFlowCanvas'));
  });

  it('DocumentsPage usa DataTable com stretch e min-height', () => {
    const source = readSrc('features/documents/DocumentsPage.tsx');
    const table = readSrc('components/ui/DataTable.tsx');
    assert.ok(source.includes('PageShell'));
    assert.ok(source.includes('FilterBar'));
    assert.ok(source.includes('stretch'));
    assert.ok(source.includes('sparseMessage'));
    assert.ok(table.includes('stretch'));
  });

  it('EmptyState suporta área expansível', () => {
    const source = readSrc('components/ui/EmptyState.tsx');
    assert.ok(source.includes('stretch'));
    assert.ok(source.includes('min-h-[360px]'));
    assert.ok(source.includes('flex-1'));
  });

  it('DocumentViewerModal permanece com overlay fixo', () => {
    const modal = readSrc('features/documents/viewer/DocumentViewerModal.tsx');
    const shell = readSrc('features/documents/viewer/DocumentViewerShell.tsx');
    assert.ok(modal.includes('DocumentViewerShell'));
    assert.ok(shell.includes('fixed'));
    assert.ok(shell.includes('z-['));
  });

  it('páginas internas principais usam PageShell', () => {
    const pages = [
      'features/documents/DashboardPage.tsx',
      'features/documents/DocumentsPage.tsx',
      'features/settings/SettingsPage.tsx',
      'features/rules/RulesPage.tsx',
      'features/users/UsersPage.tsx',
      'features/audit/AuditPage.tsx',
      'features/tracking/TrackingPage.tsx',
    ];

    for (const page of pages) {
      const source = readSrc(page);
      assert.ok(source.includes('PageShell'), `${page} deve usar PageShell`);
    }
  });
});
