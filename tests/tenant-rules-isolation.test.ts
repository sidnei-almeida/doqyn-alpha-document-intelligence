import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { resolveTenantId } from '../server/auth/tenantContext.js';
import { isConfidentialityClassRule } from '../server/ai/utils/documentClassHeuristics.js';
import {
  buildClassRuleOwnershipFilter,
  buildDocumentOwnershipFilter,
} from '../server/tenancy/documentOwnership.js';
import {
  resolveTenantStorageContextFromIds,
  type TenantStorageContext,
} from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import {
  DocumentRulesNotSeededError,
  mapCategoryExtractionRules,
} from '../server/services/documentRulesService.js';
import { isAllowMockRulesEnabled } from '../server/services/documentRulesConfig.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function readServer(relativePath: string): string {
  return readFileSync(join(repoRoot, 'server', relativePath), 'utf8');
}

function businessCtx(tenantId: string): TenantStorageContext {
  return resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'business',
    collectionPrefix: tenantId,
  });
}

function individualCtx(tenantId: string, userId: string): TenantStorageContext {
  return resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'individual',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    userId,
  });
}

function tenantNdaCategory(tenantId: string) {
  return {
    _id: `cat_nda_${tenantId}`,
    tenantId,
    companyId: tenantId,
    name: 'NDA',
    description: 'Acordo de confidencialidade',
    keywords: ['nda', 'confidencial'],
    negativeKeywords: [],
    active: true,
  };
}

function tenantNdaRule(tenantId: string, categoryId: string, fieldKey: string) {
  return {
    _id: `ext_${categoryId}_v1`,
    tenantId,
    companyId: tenantId,
    categoryId,
    classId: categoryId,
    version: 1,
    active: true,
    fields: [{ key: fieldKey, label: fieldKey, type: 'string' as const, required: false }],
    namingTemplate: 'nda_{titulo}',
  };
}

describe('isolamento tenant — regras de classificação', () => {
  it('A. business A e B com NDA mapeiam campos distintos', () => {
    const tenantA = 'company_alpha_nd';
    const tenantB = 'company_beta_nd';
    const catA = tenantNdaCategory(tenantA);
    const catB = tenantNdaCategory(tenantB);
    const rulesA = mapCategoryExtractionRules([catA], [tenantNdaRule(tenantA, catA._id, 'campo_a')]);
    const rulesB = mapCategoryExtractionRules([catB], [tenantNdaRule(tenantB, catB._id, 'campo_b')]);

    assert.equal(rulesA.length, 1);
    assert.equal(rulesB.length, 1);
    assert.equal(rulesA[0]!.fields[0]!.key, 'campo_a');
    assert.equal(rulesB[0]!.fields[0]!.key, 'campo_b');
    assert.notEqual(rulesA[0]!.id, rulesB[0]!.id);
  });

  it('A. filtro business A não inclui tenant B', () => {
    const filterA = buildDocumentOwnershipFilter(businessCtx('company_alpha'));
    const filterB = buildDocumentOwnershipFilter(businessCtx('company_beta'));
    assert.notDeepEqual(filterA, filterB);
    assert.ok(filterA.$or);
    assert.deepEqual(filterA.$or![0], { tenantId: 'company_alpha' });
    assert.deepEqual(filterB.$or![0], { tenantId: 'company_beta' });
  });

  it('B. tenant sem regra mapeada retorna lista vazia', () => {
    const cat = tenantNdaCategory('company_empty');
    const mapped = mapCategoryExtractionRules([cat], []);
    assert.deepEqual(mapped, []);
  });

  it('B. loadActiveDocumentClassRules exige tenantId explícito', () => {
    const source = readServer('services/documentRulesService.ts');
    assert.equal(source.includes('companyId: string = DEV_TENANT_ID'), false);
    assert.ok(source.includes('TENANT_REQUIRED'));
  });

  it('C. PF A e PF B usam filtros de ownership distintos', () => {
    const filterA = buildClassRuleOwnershipFilter(individualCtx('individual_alice', 'user_alice'));
    const filterB = buildClassRuleOwnershipFilter(individualCtx('individual_bob', 'user_bob'));

    assert.deepEqual(filterA, {
      tenantType: 'individual',
      tenantId: 'individual_alice',
      ownerUserId: 'user_alice',
    });
    assert.deepEqual(filterB, {
      tenantType: 'individual',
      tenantId: 'individual_bob',
      ownerUserId: 'user_bob',
    });
    assert.equal(JSON.stringify(filterA).includes('global'), false);
    assert.equal(JSON.stringify(filterB).includes('global'), false);
  });

  it('D. sem tenant ativo resolveTenantId retorna TENANT_REQUIRED', () => {
    assert.throws(
      () => resolveTenantId(undefined),
      (error: ServiceError) => error.code === 'TENANT_REQUIRED',
    );
    assert.throws(
      () => resolveTenantId(''),
      (error: ServiceError) => error.code === 'TENANT_REQUIRED',
    );
  });

  it('D. analyze-pdf trata TENANT_REQUIRED', () => {
    const endpoint = readFileSync(join(repoRoot, 'api/ai/analyze-pdf.ts'), 'utf8');
    assert.ok(endpoint.includes('isServiceError(error)'));
    assert.equal(endpoint.includes('company_dev'), false);
  });

  it('E. mock global só com ALLOW_MOCK_RULES em desenvolvimento', () => {
    const rulesService = readServer('services/documentRulesService.ts');
    const config = readServer('services/documentRulesConfig.ts');
    assert.ok(config.includes('ALLOW_MOCK_RULES'));
    assert.ok(config.includes('isDevelopmentEnvironment'));
    assert.ok(rulesService.includes('isAllowMockRulesEnabled'));
    assert.equal(rulesService.includes('mongodb_not_configured'), false);
    assert.equal(isAllowMockRulesEnabled(), false);
  });

  it('heurísticas NDA usam keywords do tenant, não ID fixo de seed', () => {
    const source = readFileSync(join(repoRoot, 'server/ai/utils/documentClassHeuristics.ts'), 'utf8');
    assert.equal(source.includes('class_confidentiality_agreement'), false);
    assert.ok(
      isConfidentialityClassRule({
        name: 'Acordo de Confidencialidade',
        description: '',
        keywords: ['nda'],
      }),
    );
    assert.equal(
      isConfidentialityClassRule({
        name: 'Nota Fiscal',
        description: 'NF-e',
        keywords: ['fiscal'],
      }),
      false,
    );
  });

  it('IDs fixos de seed removidos do pipeline de análise', () => {
    const analyze = readServer('ai/services/analyzePdfService.ts');
    const retriever = readServer('services/hybridChunkRetriever.ts');
    const validation = readServer('ai/utils/validation.ts');
    const classifier = readServer('ai/services/documentClassifierAgent.ts');

    assert.equal(analyze.includes('noAiAnalyzer'), false);
    assert.equal(analyze.includes('isNoAiMode'), false);
    assert.equal(analyze.includes('AI_MODE'), false);
    assert.equal(retriever.includes('CLASS_EXTRA_TERMS'), false);
    assert.equal(retriever.includes('class_confidentiality_agreement'), false);
    assert.equal(validation.includes('class_confidentiality_agreement'), false);
    assert.equal(classifier.includes('class_confidentiality_agreement'), false);
    assert.ok(classifier.includes('isConfidentialityClassRule'));
  });

  it('ausência de regras lança DocumentRulesNotSeededError com reason', () => {
    const error = new DocumentRulesNotSeededError('detalhe', 'no_extraction_rules');
    assert.equal(error.reason, 'no_extraction_rules');
    assert.equal(error.code, 'DOCUMENT_RULES_NOT_CONFIGURED');
  });

  it('G. createDefaultExtractionRuleForCategory é tenant-scoped', () => {
    const source = readFileSync(
      join(repoRoot, 'server/services/documentExtractionRulesService.ts'),
      'utf8',
    );
    const provision = readFileSync(
      join(repoRoot, 'server/services/tenantProvisionService.ts'),
      'utf8',
    );
    assert.ok(source.includes('createDefaultExtractionRuleForCategory'));
    assert.ok(source.includes('createDocumentExtractionRule(tenantId'));
    assert.ok(source.includes('documentExtractionRules'));
    assert.ok(source.includes('não catálogo global'));
    assert.equal(provision.includes('createDefaultExtractionRuleForCategory'), false);
    assert.equal(provision.includes('createDocumentCategory'), false);
  });
});
