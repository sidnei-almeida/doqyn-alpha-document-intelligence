import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import type { AuthUser } from '../server/auth/types.js';
import { resolveAdminApiDenial } from '../server/utils/apiHttp.js';
import { assertCanManageCompanyMembers } from '../server/auth/memberAuth.js';

function user(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'user_1',
    email: 'pessoa@empresa.test',
    name: 'Pessoa',
    companyId: 'company_a',
    tenantId: 'company_a',
    companyName: 'Empresa A',
    role: 'user',
    area: '',
    groups: [],
    tenantType: 'business',
    platformRoles: ['user'],
    ...overrides,
  } as AuthUser;
}

const member = user({});
const companyAdmin = user({ platformRoles: ['company_admin'] });
const individualOwner = user({
  tenantId: 'individual_b',
  companyId: 'individual_b',
  tenantType: 'individual',
  platformRoles: ['individual_admin', 'user'],
});

describe('withAdminMongoApi — configuração de governança', () => {
  it('qualquer membro lê', () => {
    assert.equal(resolveAdminApiDenial('GET', member), null);
    assert.equal(resolveAdminApiDenial('HEAD', member), null);
  });

  it('membro comum não escreve', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(resolveAdminApiDenial(method, member)?.status, 403, method);
    }
  });

  it('company_admin escreve', () => {
    assert.equal(resolveAdminApiDenial('PUT', companyAdmin), null);
  });

  it('dono do tenant PF escreve no próprio acervo', () => {
    assert.equal(resolveAdminApiDenial('POST', individualOwner), null);
  });

  it('individual_admin fora de tenant PF não vale', () => {
    const mismatch = user({ tenantType: 'business', platformRoles: ['individual_admin'] });
    assert.equal(resolveAdminApiDenial('POST', mismatch)?.status, 403);
  });
});

describe('withAdminMongoApi — gestão de membros', () => {
  it('só company_admin, inclusive para ler', () => {
    assert.equal(resolveAdminApiDenial('GET', member, 'user_management')?.status, 403);
    assert.equal(resolveAdminApiDenial('PUT', member, 'user_management')?.status, 403);
    assert.equal(resolveAdminApiDenial('PUT', individualOwner, 'user_management')?.status, 403);
    assert.equal(resolveAdminApiDenial('PUT', companyAdmin, 'user_management'), null);
  });

  it('rotas de membros declaram gestão de membros', () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    for (const file of ['index.ts', 'item.ts', 'status.ts', 'groups.ts']) {
      const source = readFileSync(join(repoRoot, 'api/company-members', file), 'utf8');
      assert.ok(source.includes("access: 'user_management'"), `api/company-members/${file}`);
    }
  });

  it('serviço de membros recusa membro comum mesmo sem o wrapper', () => {
    assert.throws(
      () => assertCanManageCompanyMembers(member, 'company_a'),
      (error: { statusCode?: number }) => error.statusCode === 403,
    );
    assert.throws(
      () => assertCanManageCompanyMembers(companyAdmin, 'company_outra'),
      (error: { statusCode?: number }) => error.statusCode === 403,
    );
    assert.doesNotThrow(() => assertCanManageCompanyMembers(companyAdmin, 'company_a'));
  });
});
