import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildDocumentOwnershipFilter } from '../server/tenancy/documentOwnership.js';
import { resolveTenantStorageContextFromIds } from '../server/tenancy/tenantStorage.js';
import { buildDocumentListQuery } from '../server/utils/documentListQuery.js';
import {
  buildDeactivatedListQuery,
  buildTrashListQuery,
} from '../server/services/trash/trashListQueries.js';
import { buildAuditEventsQuery } from '../server/services/auditService.js';

/**
 * As coleções são compartilhadas entre tenants, então o escopo é a única coisa entre um tenant e o
 * acervo dos outros. A busca da biblioteca, da lixeira, dos desativados e da auditoria gravava o
 * próprio `$or` por cima do `$or` do escopo, e a consulta saía sem tenant nenhum.
 *
 * O contrato provado aqui: o escopo é o primeiro item de `$and`, inteiro, e não há `$or` no topo.
 * Um filtro que grave a mesma chave do escopo no topo (`ownerUserId` do filtro "de outros") não o
 * substitui mais: soma uma condição ao lado dele.
 */

const business = resolveTenantStorageContextFromIds({
  tenantId: 'company_a_ab12cd',
  tenantType: 'business',
});
const individual = resolveTenantStorageContextFromIds({
  tenantId: 'individual_b_cd34',
  tenantType: 'individual',
  userId: 'user_b',
});

function assertScoped(query: Record<string, unknown>, scope: Record<string, unknown>) {
  assert.ok(Array.isArray(query.$and), 'o escopo precisa estar em $and');
  assert.deepEqual((query.$and as unknown[])[0], scope, 'o primeiro item de $and é o escopo');
  assert.equal('$or' in query, false, '$or no topo substituiria outro $or');
}

describe('escopo de tenant nas consultas de listagem', () => {
  it('escopo empresarial não usa $or', () => {
    const scope = buildDocumentOwnershipFilter(business);
    assert.deepEqual(scope, { tenantId: 'company_a_ab12cd' });
  });

  for (const [label, storage] of [
    ['empresa', business],
    ['pessoa física', individual],
  ] as const) {
    const scope = buildDocumentOwnershipFilter(storage);

    it(`biblioteca (${label}): nenhuma combinação de filtro tira o escopo`, () => {
      const combinations = [
        {},
        { search: 'contrato' },
        { type: 'pdf' },
        { type: 'image' },
        { type: 'other' },
        { search: 'contrato', type: 'pdf' },
        { owner: 'others', ownerUserId: 'user_b' },
        { owner: 'me', ownerUserId: 'user_b', search: 'x' },
        { status: 'active', excludeArchived: true, from: '2026-01-01', to: '2026-12-31' },
      ];
      for (const filters of combinations) {
        assertScoped(buildDocumentListQuery(scope, filters), scope);
      }
    });

    it(`lixeira e desativados (${label}): busca não tira o escopo`, () => {
      for (const search of [undefined, '', 'contrato']) {
        assertScoped(buildTrashListQuery(scope, search), scope);
        assertScoped(buildDeactivatedListQuery(scope, search), scope);
      }
    });

    it(`auditoria (${label}): busca, severidade e categoria não tiram o escopo`, () => {
      const combinations = [
        {},
        { q: 'download' },
        { q: 'download', severity: 'error' },
        { q: 'x', severity: 'info', category: 'security' as const, cursor: '2026-09-01' },
        { documentId: 'doc_1', actorId: 'user_b', type: 'document.downloaded' },
      ];
      for (const filters of combinations) {
        assertScoped(buildAuditEventsQuery(scope, filters), scope);
      }
    });
  }

  it('busca da biblioteca continua presente ao lado do escopo', () => {
    const scope = buildDocumentOwnershipFilter(business);
    const query = buildDocumentListQuery(scope, { search: 'contrato', type: 'pdf' });
    const clauses = query.$and as Record<string, unknown>[];
    assert.equal(clauses.length, 3);
    assert.ok(Array.isArray(clauses[1]!.$or));
    assert.ok(Array.isArray(clauses[2]!.$or));
  });
});

describe('guarda de código: $or nunca atribuído no topo de uma consulta', () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

  function listTs(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return listTs(path);
      return path.endsWith('.ts') ? [path] : [];
    });
  }

  it('nenhum arquivo de server/ ou api/ grava $or ou mescla cláusula por Object.assign', () => {
    const offenders: string[] = [];
    for (const file of [...listTs(join(repoRoot, 'server')), ...listTs(join(repoRoot, 'api'))]) {
      const code = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');
      if (/\.\$or\s*=(?!=)/.test(code) || /Object\.assign\(\s*(query|filter)\b/.test(code)) {
        offenders.push(relative(repoRoot, file));
      }
    }
    assert.deepEqual(offenders, [], 'use addAndClause (server/utils/mongoQuery.ts)');
  });
});
