import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { COLLECTIONS } from '../server/db/constants.js';
import {
  resolveSharedCollections,
  resolveTenantStorageContextFromIds,
} from '../server/tenancy/tenantStorage.js';
import { buildDocumentOwnershipFilter } from '../server/tenancy/documentOwnership.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('modelo de coleções compartilhadas — Passo 7 do plano de escala', () => {
  it('provisionar tenant não cria namespace novo', () => {
    const provision = read('server/services/tenantProvisionService.ts');

    // O laço que criava as 10 coleções do tenant sumiu; sobrou uma garantia do conjunto único.
    assert.ok(provision.includes('ensureSharedCollectionIndexes'));
    assert.equal(provision.includes('listTenantCollectionNames'), false);
    assert.equal(provision.includes('ensureTenantDataIndexes'), false);
  });

  it('nenhum nome de coleção é montado com sufixo de tenant', () => {
    for (const path of [
      'server/tenancy/tenantStorage.ts',
      'server/tenancy/tenantResolver.ts',
    ]) {
      const source = read(path);
      assert.equal(
        /\$\{base\}_\$\{prefix\}/.test(source),
        false,
        `${path} ainda monta nome prefixado`,
      );
      assert.equal(source.includes('resolvePrefixedName'), false, `${path} ainda prefixa`);
    }
  });

  it('as coleções resolvidas são exatamente as constantes base', () => {
    const shared = resolveSharedCollections();

    assert.equal(shared.documents, COLLECTIONS.documents);
    assert.equal(shared.documentVersions, COLLECTIONS.documentVersions);
    assert.equal(shared.documentChunks, COLLECTIONS.documentChunks);
    assert.equal(shared.processingJobs, COLLECTIONS.processingJobs);
    assert.equal(shared.auditLogs, COLLECTIONS.auditLogs);

    for (const name of Object.values(shared)) {
      assert.equal(typeof name, 'string');
      assert.equal((name as string).includes('_company'), false);
      assert.equal((name as string).endsWith('_compartilhado'), false);
    }
  });

  it('mil tenants resolvem para o mesmo conjunto de 10 coleções', () => {
    const seen = new Set<string>();

    for (let i = 0; i < 1000; i += 1) {
      const ctx = resolveTenantStorageContextFromIds({
        tenantId: `company_stress_${i}`,
        tenantType: 'business',
      });
      for (const name of Object.values(ctx.collections)) {
        if (name) seen.add(name as string);
      }
    }

    // Era isto que estourava o Atlas: 10 coleções × N tenants. Agora é 10, ponto.
    assert.equal(seen.size, 10);
  });

  it('todo índice de dado de tenant lidera por tenantId', () => {
    const indexes = read('server/db/tenantIndexes.ts');
    const specsStart = indexes.indexOf('function tenantScopedIndexSpecs');
    const specsEnd = indexes.indexOf('export async function ensureSharedCollectionIndexes');
    const specs = indexes.slice(specsStart, specsEnd);

    const keys = [...specs.matchAll(/key:\s*\{\s*([A-Za-z'"][\w'".]*)\s*:/g)].map((m) =>
      m[1].replace(/['"]/g, ''),
    );

    assert.ok(keys.length > 20, `esperava dezenas de índices, achei ${keys.length}`);
    for (const first of keys) {
      assert.equal(
        first,
        'tenantId',
        `índice liderado por "${first}" não usa o prefixo de tenant e varre o pool inteiro`,
      );
    }
  });

  it('o conjunto duplicado de índices por ownerTenantId foi removido', () => {
    const indexes = read('server/db/tenantIndexes.ts');

    // ownerTenantId recebe o mesmo valor de tenantId na gravação: manter os dois conjuntos
    // dobraria os namespaces, justo o custo que este passo corta.
    assert.equal(indexes.includes('sharedIndividualIndexSpecs'), false);
    assert.equal(indexes.includes('ensureSharedIndividualIndexes'), false);
  });

  it('o filtro de tenant não tem escapatória para documento sem dono', () => {
    const ownership = read('server/tenancy/documentOwnership.ts');

    assert.equal(
      ownership.includes('$exists: false'),
      false,
      'ramo para documento sem tenantId vaza todo o pool',
    );

    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'company_x',
      tenantType: 'business',
    });
    assert.deepEqual(buildDocumentOwnershipFilter(ctx), {
      $or: [{ tenantId: 'company_x' }, { companyId: 'company_x' }],
    });
  });
});
