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
  it('OverviewMetricCard destaca label, valor e subtexto', () => {
    const source = readSrc('features/dashboard/components/OverviewMetricCard.tsx');
    assert.ok(source.includes('tabular-nums'));
    assert.ok(source.includes('overview-kpi-label'));
    assert.ok(source.includes('overview-kpi-subtext'));
  });

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

  it('documentos recentes truncam nome e usam IconButton', () => {
    const source = readSrc('features/dashboard/components/OverviewRecentDocumentsPanel.tsx');
    assert.ok(source.includes('RecentDocumentRow'));
    assert.ok(source.includes('TruncatedText'));
    assert.ok(source.includes('IconButton'));
  });

  it('feed de atividade separa ator, documento e timestamp', () => {
    const source = readSrc('features/dashboard/components/OverviewRecentActivityPanel.tsx');
    assert.ok(source.includes('ActivityTimelineItem'));
    assert.ok(source.includes('justify-between'));
    assert.ok(source.includes('<time'));
  });

  it('PageHeader delega para WorkspacePageHeader', () => {
    const source = readSrc('components/layout/PageHeader.tsx');
    const workspace = readSrc('components/layout/WorkspacePageHeader.tsx');
    assert.ok(source.includes('WorkspacePageHeader'));
    assert.ok(workspace.includes('workspace-page-subtitle'));
  });
});
