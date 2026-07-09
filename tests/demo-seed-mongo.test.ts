import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapCategoryExtractionRules } from '../server/services/documentRulesService.js';
import { deriveAnalysisReady } from '../server/tenancy/governanceAudit.js';
import {
  buildGovernanceSeedForTenant,
  buildPipelineOwnershipFilterForTenant,
  countSeedRowsMatchingPipelineFilter,
} from '../scripts/demo-seed/governance.js';
import { DEMO_MANIFEST_VERSION } from '../scripts/demo-seed/manifest.js';

const repoRoot = join(import.meta.dirname, '..');
const DEMO_TENANT_ID = 'company_alpha_consultoria';

describe('demo seed mongo', () => {
  it('expõe script dev:seed:demo no package.json', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    assert.equal(pkg.scripts['dev:seed:demo'], 'tsx scripts/demo-seed/index.ts');
    assert.notEqual(pkg.scripts['dev:seed:demo'], pkg.scripts['db:setup']);
  });

  it('gera governança por tenant com ownership compatível com o pipeline', () => {
    const seed = buildGovernanceSeedForTenant(DEMO_TENANT_ID);

    assert.ok(seed.categories.length > 0);
    assert.ok(seed.groups.length > 0);
    assert.ok(seed.extractionRules.length > 0);

    for (const category of seed.categories) {
      assert.equal(category.tenantId, DEMO_TENANT_ID);
      assert.equal(category.companyId, DEMO_TENANT_ID);
      assert.equal(category.tenantType, 'business');
      assert.equal(category.ownerTenantId, DEMO_TENANT_ID);
      assert.equal(category.active, true);
    }

    for (const extractionRule of seed.extractionRules) {
      assert.equal(extractionRule.tenantType, 'business');
      assert.equal(extractionRule.ownerTenantId, DEMO_TENANT_ID);
      assert.equal(extractionRule.active, true);
      assert.ok(extractionRule.categoryId.length > 0);
      assert.ok(extractionRule.fields.length > 0);
    }
  });

  it('seed demo passa pelo mesmo filtro de ownership usado no pipeline', () => {
    const seed = buildGovernanceSeedForTenant(DEMO_TENANT_ID);
    const counts = countSeedRowsMatchingPipelineFilter(seed, DEMO_TENANT_ID);

    assert.ok(counts.activeCategories > 0);
    assert.ok(counts.activeExtractionRules > 0);
    assert.ok(counts.activeAccessRules > 0);
    assert.ok(Object.keys(buildPipelineOwnershipFilterForTenant(DEMO_TENANT_ID)).length > 0);
  });

  it('mapCategoryExtractionRules retorna regras mapeadas para tenant demo', () => {
    const seed = buildGovernanceSeedForTenant(DEMO_TENANT_ID);
    const mapped = mapCategoryExtractionRules(seed.categories, seed.extractionRules);

    assert.ok(mapped.length > 0);
    assert.ok(mapped.every((rule) => rule.fields.length > 0));
  });

  it('deriveAnalysisReady fica true com categorias e extração ativas, sem exigir matriz de acesso', () => {
    const seed = buildGovernanceSeedForTenant(DEMO_TENANT_ID);
    const readiness = deriveAnalysisReady({
      activeCategoriesCount: seed.categories.length,
      activeExtractionRulesCount: seed.extractionRules.length,
      mappedRulesCount: 0,
    });

    assert.equal(readiness.ready, true);
    assert.equal(readiness.reasons.length, 0);
  });

  it('manifest version e source são estáveis', () => {
    assert.equal(DEMO_MANIFEST_VERSION, 1);
  });

  it('provisionTenants inclui company_dev e sync de operadores', () => {
    const provisionSource = readFileSync(
      join(repoRoot, 'scripts/demo-seed/provisionTenants.ts'),
      'utf8',
    );
    const syncSource = readFileSync(join(repoRoot, 'scripts/demo-seed/syncMembers.ts'), 'utf8');

    assert.ok(provisionSource.includes('ensureDevTenantSeed'));
    assert.ok(provisionSource.includes('syncDevTenantMembers'));
    assert.ok(provisionSource.includes('DEV_TENANT_ID'));
    assert.ok(syncSource.includes('manifest.globalAdmin'));
    assert.ok(syncSource.includes('companyDevActiveUsers'));
    assert.ok(syncSource.includes('userId'));
  });

  it('.gitignore ignora artefatos .generated', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.generated/'));
  });
});
