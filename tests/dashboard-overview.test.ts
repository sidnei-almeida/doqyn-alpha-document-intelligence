import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { AuthUser } from '../server/auth/types.js';
import { isDocumentAdmin } from '../server/tenancy/documentAccess.js';
import { getDashboardOverview } from '../server/services/dashboardOverviewService.js';

const repoRoot = join(import.meta.dirname, '..');

function adminUser(tenantId = 'company_alpha'): AuthUser {
  return {
    id: 'user_admin',
    email: 'admin@empresa.com',
    name: 'Admin',
    companyId: tenantId,
    tenantId,
    role: 'admin',
    platformRoles: ['company_admin'],
  };
}

function commonUser(tenantId = 'company_alpha'): AuthUser {
  return {
    id: 'user_common',
    email: 'user@empresa.com',
    name: 'User',
    companyId: tenantId,
    tenantId,
    role: 'user',
    platformRoles: ['user'],
  };
}

describe('GET /api/dashboard/overview handler', () => {
  const handlerSource = readFileSync(join(repoRoot, 'api/dashboard/overview.ts'), 'utf8');

  it('exige autenticação e tenant da sessão', () => {
    assert.match(handlerSource, /requireDocumentAuthContext/);
    assert.match(handlerSource, /assertQueryTenantMatchesSession/);
    assert.match(handlerSource, /getDashboardOverview/);
  });

  it('aceita period, from, to e tenantId de query', () => {
    assert.match(handlerSource, /period/);
    assert.match(handlerSource, /from/);
    assert.match(handlerSource, /to/);
    assert.match(handlerSource, /tenantId/);
  });

  it('não expõe objectKey ou URL R2 na resposta', () => {
    const serviceSource = readFileSync(
      join(repoRoot, 'server/services/dashboardOverviewService.ts'),
      'utf8',
    );
    assert.doesNotMatch(handlerSource, /objectKey|r2\.cloudflarestorage|presigned/i);
    assert.doesNotMatch(serviceSource, /objectKey|r2\.cloudflarestorage|presigned/i);
    assert.match(serviceSource, /maskBucketName/);
    assert.match(
      serviceSource,
      /activeCategories[\s\S]*countDocuments\(\{ \.\.\.scope, active: true \}/,
    );
  });
});

describe('dashboardOverviewService', () => {
  it('company_admin recebe mode full', () => {
    assert.equal(isDocumentAdmin(adminUser()), true);
  });

  it('user comum recebe mode operational', () => {
    assert.equal(isDocumentAdmin(commonUser()), false);
  });

  it('sem Mongo retorna contagens zeradas e arrays vazios', async () => {
    const overview = await getDashboardOverview({
      tenantId: 'tenant_empty',
      userId: 'user_1',
      user: adminUser('tenant_empty'),
    });

    assert.equal(overview.summary.totalDocuments, 0);
    assert.deepEqual(overview.documentsByStatus, []);
    assert.deepEqual(overview.documentsByCategory, []);
    assert.deepEqual(overview.recentDocuments, []);
    assert.deepEqual(overview.recentTrackingEvents, []);
    assert.deepEqual(overview.recentErrors, []);
    assert.equal(overview.mode, 'full');
    assert.ok(overview.governance);
    assert.ok(overview.storage);
  });

  it('user comum sem Mongo não recebe governança nem storage', async () => {
    const overview = await getDashboardOverview({
      tenantId: 'tenant_empty',
      userId: 'user_common',
      user: commonUser('tenant_empty'),
    });

    assert.equal(overview.mode, 'operational');
    assert.equal(overview.governance, null);
    assert.equal(overview.storage, null);
  });

  it('rejeita tenantId vazio', async () => {
    await assert.rejects(
      () =>
        getDashboardOverview({
          tenantId: '   ',
          userId: 'user_1',
          user: adminUser(),
        }),
      (error: Error & { code?: string }) => error.code === 'TENANT_REQUIRED',
    );
  });

  it('period default é 30d quando Mongo ausente', async () => {
    const overview = await getDashboardOverview({
      tenantId: 'tenant_empty',
      userId: 'user_1',
      user: adminUser('tenant_empty'),
    });
    assert.equal(overview.period.key, '30d');
    assert.ok(overview.period.from);
    assert.ok(overview.period.to);
  });
});

describe('dashboard overview UI', () => {
  const pageSource = readFileSync(
    join(repoRoot, 'src/features/documents/DashboardPage.tsx'),
    'utf8',
  );
  const periodSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/components/OverviewPeriodSelector.tsx'),
    'utf8',
  );
  const documentsPanelSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/components/OverviewRecentDocumentsPanel.tsx'),
    'utf8',
  );
  const activityPanelSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/components/OverviewRecentActivityPanel.tsx'),
    'utf8',
  );
  const governanceSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/components/OverviewGovernancePanel.tsx'),
    'utf8',
  );
  const hookSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/hooks/useDashboardOverview.ts'),
    'utf8',
  );
  const apiSource = readFileSync(
    join(repoRoot, 'src/features/dashboard/api/dashboardApi.ts'),
    'utf8',
  );

  it('DashboardPage não importa mock-data nem MOCK_DOCUMENTS', () => {
    assert.equal(pageSource.includes('MOCK_DOCUMENTS'), false);
    assert.equal(pageSource.includes('mock-data'), false);
  });

  it('DashboardPage consome endpoint real via hook', () => {
    assert.match(pageSource, /useDashboardOverview/);
    assert.match(hookSource, /fetchDashboardOverview/);
    assert.match(apiSource, /\/api\/dashboard\/overview/);
    assert.match(hookSource, /tenant\?\.tenantId/);
  });

  it('DashboardPage renderiza cards, período e estados', () => {
    assert.match(pageSource, /buildOverviewMetrics|OverviewSummaryStrip/);
    assert.match(periodSource, /7 dias|30 dias|90 dias/);
    assert.match(pageSource, /Carregando visão geral/);
    assert.match(pageSource, /Não foi possível carregar a visão geral/);
    assert.match(documentsPanelSource, /Nenhum documento enviado ainda/);
  });

  it('DashboardPage abre DocumentViewerModal ao clicar documento', () => {
    assert.match(pageSource, /DocumentViewerModal/);
    assert.match(documentsPanelSource, /latestVersionId/);
    assert.match(documentsPanelSource, /canPreview/);
  });

  it('DashboardPage mostra governança apenas em mode full', () => {
    assert.match(pageSource, /data\.mode === 'full'/);
    assert.match(pageSource, /OverviewQuickAccessPanel/);
    assert.match(pageSource, /canManageGovernance=\{isAdmin\}/);
    assert.match(governanceSource, /Governança documental/);
    assert.match(activityPanelSource, /Atividade recente/);
  });

  it('saúde do ambiente diferencia acesso restrito para usuário comum', () => {
    const healthCard = readFileSync(
      join(repoRoot, 'src/features/dashboard/components/OverviewEnvironmentHealthCard.tsx'),
      'utf8',
    );
    assert.match(healthCard, /canManageGovernance/);
    assert.match(healthCard, /overview-health-badge--restricted/);
    assert.match(healthCard, /Aguardando configuração pelo administrador/);
    assert.match(healthCard, /Categorias ativas no ambiente/);
  });

  it('DashboardPage não exibe objectKey ou URL R2', () => {
    assert.doesNotMatch(pageSource, /objectKey|r2\.cloudflarestorage|presigned/i);
  });

  it('dev-server registra rota /api/dashboard/overview', () => {
    const devServerSource = readFileSync(join(repoRoot, 'server/dev-server.ts'), 'utf8');
    assert.match(devServerSource, /\/api\/dashboard\/overview/);
  });
});
