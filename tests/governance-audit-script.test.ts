import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  buildGovernanceAuditTargets,
  deriveAnalysisReady,
  formatTenantNotFoundMessage,
  inferCollectionPrefixesFromDb,
  normalizeTenantForAudit,
  parseGovernanceAuditTenantArg,
  safeResolveTenantCollectionNames,
} from '../server/tenancy/governanceAudit.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';

const repoRoot = join(import.meta.dirname, '..');

describe('governance audit helpers', () => {
  it('inferCollectionPrefixesFromDb extrai tenantIds pelos nomes das collections', () => {
    const prefixes = inferCollectionPrefixesFromDb([
      'document_categories_company_acme_ab12cd',
      'document_extraction_rules_company_acme_ab12cd',
      'document_rules_company_beta_xy99zz',
      'users',
      'document_categories_compartilhado',
    ]);

    assert.deepEqual(prefixes, [
      'company_acme_ab12cd',
      'company_beta_xy99zz',
      SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    ]);
  });

  it('audit sem tenantId não depende de isolation no registry (normaliza tenant)', () => {
    const normalized = normalizeTenantForAudit({
      tenantId: 'company_acme_ab12cd',
      tenantType: 'business',
    });

    const resolved = safeResolveTenantCollectionNames(normalized);
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.collectionPrefix, 'company_acme_ab12cd');
      // O prefixo continua no registry (identifica o tenant), mas não nomeia mais coleção.
      assert.equal(resolved.names.documentCategories, 'document_categories');
    }
  });

  it('collectionPrefix undefined gera erro amigável sem stack trace', () => {
    const resolved = safeResolveTenantCollectionNames({ tenantId: '' });
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.match(resolved.error, /tenantId ausente/i);
      assert.equal(resolved.code, 'TENANT_ID_MISSING');
    }
  });

  it('buildGovernanceAuditTargets sem filtro inclui registry e collections inferidas', () => {
    const targets = buildGovernanceAuditTargets({
      registryTenants: [
        { tenantId: 'company_acme_ab12cd', tenantType: 'business', status: 'active' },
      ],
      dbCollectionNames: [
        'document_categories_company_acme_ab12cd',
        'document_categories_company_orphan_zz11aa',
      ],
    });

    const tenantIds = targets.map((target) => target.tenantId);
    assert.ok(tenantIds.includes('company_acme_ab12cd'));
    assert.ok(tenantIds.includes('company_orphan_zz11aa'));
  });

  it('buildGovernanceAuditTargets com tenantId audita somente o tenant pedido', () => {
    const targets = buildGovernanceAuditTargets({
      registryTenants: [
        { tenantId: 'company_acme_ab12cd', tenantType: 'business' },
        { tenantId: 'company_beta_xy99zz', tenantType: 'business' },
      ],
      dbCollectionNames: [
        'document_categories_company_acme_ab12cd',
        'document_categories_company_beta_xy99zz',
      ],
      tenantFilter: 'company_beta_xy99zz',
    });

    assert.equal(targets.length, 1);
    assert.equal(targets[0]?.tenantId, 'company_beta_xy99zz');
  });

  it('collections ausentes retornam contagem 0 via safe resolve parcial', () => {
    const resolved = safeResolveTenantCollectionNames({
      tenantId: 'company_missing_collections',
      tenantType: 'business',
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.names.documentExtractionRules, 'document_extraction_rules');
    }
  });

  it('deriveAnalysisReady contabiliza motivos quando faltam regras', () => {
    const result = deriveAnalysisReady({
      activeCategoriesCount: 0,
      activeExtractionRulesCount: 0,
    });

    assert.equal(result.ready, false);
    assert.ok(result.reasons.some((reason) => /categorias ativas/i.test(reason)));
    assert.ok(result.reasons.some((reason) => /extração ativas/i.test(reason)));
  });

  it('deriveAnalysisReady não bloqueia análise por matriz document_rules vazia', () => {
    const result = deriveAnalysisReady({
      activeCategoriesCount: 3,
      activeExtractionRulesCount: 3,
      mappedRulesCount: 0,
    });

    assert.equal(result.ready, true);
    assert.equal(result.reasons.length, 0);
  });

  it('parseGovernanceAuditTenantArg aceita posicional e --tenant', () => {
    assert.equal(
      parseGovernanceAuditTenantArg(['node', 'audit', 'company_alpha_consultoria']),
      'company_alpha_consultoria',
    );
    assert.equal(
      parseGovernanceAuditTenantArg(['node', 'audit', '--tenant', 'company_horizonte_logistica']),
      'company_horizonte_logistica',
    );
    assert.equal(
      parseGovernanceAuditTenantArg(['node', 'audit', '--tenant=company_metalprime_industrias']),
      'company_metalprime_industrias',
    );
    assert.equal(parseGovernanceAuditTenantArg(['node', 'audit']), undefined);
  });

  it('PF individual marca auditoria parcial', () => {
    const targets = buildGovernanceAuditTargets({
      registryTenants: [
        {
          tenantId: 'individual_maria_ab12cd',
          tenantType: 'individual',
          status: 'active',
        },
      ],
      dbCollectionNames: ['document_categories_compartilhado'],
    });

    assert.equal(targets.length, 1);
    assert.match(targets[0]?.pfAuditNote ?? '', /PF\/shared audit: parcial/i);
  });

  it('formatTenantNotFoundMessage lista exemplos sem dados sensíveis', () => {
    const message = formatTenantNotFoundMessage('company_unknown', [
      'company_acme_ab12cd',
      SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    ]);

    assert.match(message, /Tenant não encontrado/i);
    assert.match(message, /company_acme_ab12cd/);
    assert.equal(message.includes('123.456.789-00'), false);
    assert.equal(message.includes('GROQ'), false);
  });
});

describe('script audit:governance-rules', () => {
  it('usa helpers seguros e não acessa collectionPrefix sem validação', () => {
    const script = readFileSync(join(repoRoot, 'scripts/audit-governance-rules.ts'), 'utf8');

    assert.ok(script.includes('safeResolveTenantCollectionNames'));
    assert.ok(script.includes('buildGovernanceAuditTargets'));
    assert.ok(script.includes('parseGovernanceAuditTenantArg'));
    assert.ok(script.includes('sanitizeGovernanceDocumentSample'));
    assert.ok(script.includes('listCollections'));
    assert.equal(script.includes("projection: { tenantId: 1, tenantType: 1, status: 1 }"), false);
    assert.ok(script.includes('isolation: 1'));
  });

  it('npm script audit:governance-rules continua registrado', () => {
    const pkg = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    assert.ok(pkg.includes('audit:governance-rules'));
  });
});
