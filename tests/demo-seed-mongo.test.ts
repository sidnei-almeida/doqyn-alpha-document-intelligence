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

  it('dois tenants não compartilham _id no seed de governança', () => {
    const alpha = buildGovernanceSeedForTenant('company_alpha');
    const beta = buildGovernanceSeedForTenant('company_beta');

    // Com coleções compartilhadas o `_id` é global: ids fixos fariam o segundo seed sobrescrever
    // o `tenantId` das linhas do primeiro, transferindo a governança inteira para o último tenant.
    const idsOf = (seed: typeof alpha) =>
      [...seed.categories, ...seed.groups, ...seed.accessRules, ...seed.extractionRules].map(
        (row) => row._id,
      );

    const alphaIds = new Set(idsOf(alpha));
    const collisions = idsOf(beta).filter((id) => alphaIds.has(id));
    assert.deepEqual(collisions, []);
  });

  it('as referências entre linhas do seed apontam para o próprio tenant', () => {
    const seed = buildGovernanceSeedForTenant('company_alpha');
    const categoryIds = new Set(seed.categories.map((category) => category._id));
    const groupIds = new Set(seed.groups.map((group) => group._id));

    // Renomear só o `_id` deixaria a regra de acesso apontando para a categoria de outro tenant.
    for (const rule of seed.accessRules) {
      assert.ok(categoryIds.has(rule.categoryId), `categoria órfã em ${rule._id}`);
      assert.ok(groupIds.has(rule.groupId), `grupo órfão em ${rule._id}`);
    }

    for (const extractionRule of seed.extractionRules) {
      assert.ok(categoryIds.has(extractionRule.categoryId), `categoria órfã em ${extractionRule._id}`);
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

  it('seed demo persiste formato canônico (sem dual-write legado)', () => {
    const provisionSource = readFileSync(
      join(repoRoot, 'scripts/demo-seed/provisionTenants.ts'),
      'utf8',
    );
    const syncSource = readFileSync(join(repoRoot, 'scripts/demo-seed/syncMembers.ts'), 'utf8');

    // As coleções vêm do resolver compartilhado, não de nomes montados com sufixo de tenant.
    assert.ok(provisionSource.includes('resolveSharedCollections'));
    assert.ok(provisionSource.includes('documentCategories'));
    assert.ok(provisionSource.includes('documentGroups'));
    assert.ok(provisionSource.includes('documentExtractionRules'));
    assert.equal(provisionSource.includes('document_categories_'), false);
    assert.ok(provisionSource.includes('REGISTRY_COLLECTIONS.tenants'));
    assert.equal(provisionSource.includes('REGISTRY_COLLECTIONS.companies'), false);
    assert.equal(provisionSource.includes('document_classes'), false);
    assert.equal(provisionSource.includes('access_groups_'), false);

    assert.ok(syncSource.includes('REGISTRY_COLLECTIONS.tenantMembers'));
    assert.ok(syncSource.includes('authUserId'));
    assert.equal(syncSource.includes('companyMembers'), false);
    assert.equal(syncSource.includes('keycloakUserId: input'), false);
    assert.ok(syncSource.includes("source: 'manual_seed'"));
    assert.ok(syncSource.includes("$unset: { keycloakUserId: '' }"));
  });

  it('accessRules da seed usam groupId × categoryId', () => {
    const seed = buildGovernanceSeedForTenant(DEMO_TENANT_ID);
    assert.ok(seed.accessRules.length > 0);
    for (const rule of seed.accessRules) {
      assert.ok(rule.groupId);
      assert.ok(rule.categoryId);
      assert.equal('classId' in rule && Boolean((rule as { classId?: string }).classId), false);
    }
  });

  it('.gitignore ignora artefatos .generated', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.generated/'));
  });
});
