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

describe('dashboard layout', () => {
  it('DashboardPage usa home estilo Drive com stats, sugeridos, tabela e atividade', () => {
    const source = readSrc('features/documents/DashboardPage.tsx');
    assert.ok(source.includes('HomeStatCard'));
    assert.ok(source.includes('HomeSuggestedCarousel'));
    assert.ok(source.includes('HomeRecentFilesTable'));
    assert.ok(source.includes('HomeActivityPanel'));
    assert.ok(source.includes('OverviewGovernancePanel'));
    assert.ok(source.includes('OverviewQuickAccessPanel'));
    assert.ok(source.includes('overview-insights-grid'));
    assert.ok(source.includes('overview-page w-full'));
    assert.equal(source.includes('max-w-[1440px]'), false);
  });

  it('documentos recentes usam FileTypeIcon e menu de ações por linha', () => {
    const source = readSrc('features/dashboard/components/home/HomeRecentFilesTable.tsx');
    assert.ok(source.includes('FileTypeIcon'));
    assert.ok(source.includes('TableRowActionsMenu'));
  });

  it('feed de atividade separa ator, documento e timestamp', () => {
    const source = readSrc('features/dashboard/components/home/HomeActivityPanel.tsx');
    assert.ok(source.includes('<time'));
  });

  it('PageHeader delega para WorkspacePageHeader', () => {
    const source = readSrc('components/layout/PageHeader.tsx');
    const workspace = readSrc('components/layout/WorkspacePageHeader.tsx');
    assert.ok(source.includes('WorkspacePageHeader'));
    assert.ok(workspace.includes('workspace-page-subtitle'));
  });
});
