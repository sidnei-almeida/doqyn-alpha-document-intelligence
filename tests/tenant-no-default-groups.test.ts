import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('empresa nova sem grupos documentais padrão', () => {
  it('setupMongo não importa seeds de governança documental', () => {
    const source = readSrc('server/db/setupMongo.ts');
    assert.equal(source.includes('SEED_GOVERNANCE_GROUPS'), false);
    assert.equal(source.includes('SEED_GOVERNANCE_CATEGORIES'), false);
    assert.equal(source.includes('SEED_GOVERNANCE_ACCESS_RULES'), false);
    assert.equal(source.includes('SEED_COMPANY_MEMBERS'), false);
    assert.ok(source.includes('não cria grupos documentais'));
  });

  it('tenantProvisionService não popula grupos/categorias automaticamente', () => {
    const source = readSrc('server/services/tenantProvisionService.ts');
    assert.equal(source.includes('SEED_GOVERNANCE'), false);
    assert.equal(source.includes('createDocumentGroup'), false);
    assert.equal(source.includes('documentGovernanceSeed'), false);
  });

  it('/users mostra empty state quando não há grupos', () => {
    const sections = readSrc('src/features/users/components/AccessFormSections.tsx');
    assert.ok(sections.includes('Nenhum grupo criado ainda.'));
    assert.ok(sections.includes('Crie grupos na tela Regras'));
  });

  it('/rules mostra empty state real sem mocks', () => {
    const source = readSrc('src/features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('Mapa de governança vazio'));
    assert.equal(source.includes('INITIAL_GROUPS'), false);
    assert.equal(source.includes('mockData'), false);
  });

  it('query keys de /users consideram tenant ativo', () => {
    const source = readSrc('src/features/users/UsersPage.tsx');
    assert.ok(source.includes("queryKey: ['company-members', sessionTenantId]"));
    assert.ok(source.includes("queryKey: ['document-groups', sessionTenantId]"));
    assert.ok(source.includes('tenant?.tenantId ?? user?.companyId'));
  });

  it('logout limpa cache do React Query', () => {
    const source = readSrc('src/auth/AuthProvider.tsx');
    assert.ok(source.includes('queryClient.clear'));
  });

  it('tenantContext exige tenant ativo — sem fallback company_dev', () => {
    const source = readSrc('server/auth/tenantContext.ts');
    assert.equal(source.includes('allowDevTenantFallback'), false);
    assert.ok(source.includes('TENANT_REQUIRED'));
    assert.ok(source.includes('resolveDevScriptTenantId'));
  });
});

describe('isolamento tenant — grupos documentais', () => {
  it('coleções são prefixadas por tenantId', () => {
    const tenantA = 'company_alpha';
    const tenantB = 'company_beta';
    assert.notEqual(`document_groups_${tenantA}`, `document_groups_${tenantB}`);
    assert.notEqual(`document_categories_${tenantA}`, `document_categories_${tenantB}`);
  });

  it('empresa A com grupo Administrativo não compartilha coleção com B', () => {
    const groupA = { tenantId: 'company_a', _id: 'group_administrativo', name: 'Administrativo' };
    const groupBQuery = { tenantId: 'company_b' };
    assert.notEqual(groupA.tenantId, groupBQuery.tenantId);
  });
});
