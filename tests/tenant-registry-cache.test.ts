import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('cache do registry de tenants — Passo 4 do plano de escala', () => {
  it('resolveTenant lê do cache antes do Mongo e grava no miss', () => {
    const resolver = read('server/tenancy/tenantResolver.ts');

    assert.ok(resolver.includes("from './tenantRegistryCache.js'"));

    const cacheReadAt = resolver.indexOf('await getCachedTenant(tenantId)');
    const findOneAt = resolver.indexOf('REGISTRY_COLLECTIONS.tenants).findOne');
    assert.ok(cacheReadAt > -1, 'resolveTenant deve consultar o cache');
    assert.ok(findOneAt > -1);
    assert.ok(cacheReadAt < findOneAt, 'a leitura do cache precisa vir antes do findOne');

    assert.ok(resolver.includes('await setCachedTenant(tenantId, tenant)'));
  });

  it('quotas reaproveitam o mesmo cache em vez de uma segunda ida ao registry', () => {
    const quotas = read('server/tenancy/tenantQuotas.ts');

    assert.ok(quotas.includes('await resolveTenant(tenantId)'));
    assert.equal(
      quotas.includes('REGISTRY_COLLECTIONS.tenants'),
      false,
      'loadTenantQuotaOverrides não deve mais consultar o registry direto',
    );
    // Tenant inexistente continua caindo nos defaults, não estourando o request.
    assert.ok(quotas.includes("error.code === 'TENANT_NOT_FOUND'"));
  });

  it('o cache é chaveado por tenantId e pelo alias companyId', () => {
    const cache = read('server/tenancy/tenantRegistryCache.ts');

    assert.ok(cache.includes('tenant.companyId'));
    assert.ok(cache.includes('lookupKeysFor'));
    assert.ok(cache.includes('TENANT_REGISTRY_CACHE_ENABLED'));
    assert.ok(cache.includes('TENANT_REGISTRY_CACHE_TTL_SECONDS'));
  });

  it('reidrata datas perdidas no round-trip por JSON', () => {
    const cache = read('server/tenancy/tenantRegistryCache.ts');

    assert.ok(cache.includes('reviveTenant'));
    assert.ok(cache.includes('createdAt'));
    assert.ok(cache.includes('updatedAt'));
    assert.ok(cache.includes('bucketCreatedAt'));
    assert.ok(cache.includes('bucketLastCheckedAt'));
  });

  it('não inventa data para tenant que não tem', () => {
    const cache = read('server/tenancy/tenantRegistryCache.ts');

    // `?? new Date(0)` faria um tenant legado sem createdAt virar 01/01/1970 no caminho cacheado
    // e continuar vazio no caminho direto — os dois deixariam de ser intercambiáveis.
    assert.equal(cache.includes('new Date(0)'), false);
  });

  it('invalidação alcança o alias irmão, não só o id recebido', () => {
    const cache = read('server/tenancy/tenantRegistryCache.ts');

    // O documento é gravado sob tenantId e companyId; apagar só um deixaria o outro servindo
    // dado velho pelo TTL inteiro.
    const invalidateAt = cache.indexOf('export async function invalidateTenantRegistryCache');
    const body = cache.slice(invalidateAt);

    assert.ok(body.includes('redisGetJson'), 'precisa ler o doc cacheado para achar o alias irmão');
    assert.ok(body.includes('lookupKeysFor'));
  });

  it('fecha a corrida entre leitura e gravação do cache', () => {
    const cache = read('server/tenancy/tenantRegistryCache.ts');

    // Sem a marca, um resolveTenant já em voo regravaria o retrato velho por cima da invalidação.
    assert.ok(cache.includes('buildInvalidationMarkKey'));
    assert.ok(cache.includes('INVALIDATION_MARK_TTL_SECONDS'));

    const setAt = cache.indexOf('export async function setCachedTenant');
    const setBody = cache.slice(setAt, cache.indexOf('export async function invalidate'));
    assert.ok(
      setBody.includes('redisExistsAny'),
      'setCachedTenant deve checar a marca antes de gravar',
    );
  });

  it('quota separa verificação de consumo', () => {
    const quotas = read('server/tenancy/tenantQuotas.ts');

    assert.ok(quotas.includes('export async function assertTenantQuotaAvailable'));
    assert.ok(quotas.includes('redisGetNumber'));

    // A verificação não pode incrementar: senão upload que falha depois queima cota do tenant.
    const checkAt = quotas.indexOf('export async function assertTenantQuotaAvailable');
    const checkBody = quotas.slice(checkAt, quotas.indexOf('export async function assertTenantQuota('));
    assert.equal(checkBody.includes('redisIncrWithTtl'), false);
  });

  it('todo write no registry invalida o cache explicitamente', () => {
    const writers = [
      'server/services/tenantProvisionService.ts',
      'server/services/tenantStorageConfigService.ts',
      'server/services/trash/trashRetentionSettings.ts',
      'server/services/tenantsService.ts',
    ];

    for (const path of writers) {
      const source = read(path);
      assert.ok(
        source.includes('invalidateTenantRegistryCache'),
        `${path} altera o tenant e precisa invalidar o cache`,
      );
    }
  });

  it('redisDel existe e engole falha — Redis fora do ar não derruba o write', () => {
    const client = read('server/redis/redisClient.ts');

    assert.ok(client.includes('export async function redisDel'));
    assert.ok(client.includes('if (!client) return'));
  });

  it('sem Redis o cache é transparente: leitura nula e escrita silenciosa', async () => {
    const previous = process.env.REDIS_ENABLED;
    process.env.REDIS_ENABLED = 'false';

    try {
      const { getCachedTenant, setCachedTenant, invalidateTenantRegistryCache } = await import(
        '../server/tenancy/tenantRegistryCache.js'
      );

      assert.equal(await getCachedTenant('tenant_pj_test'), null);
      await setCachedTenant('tenant_pj_test', {
        _id: 'tenant_pj_test',
        tenantId: 'tenant_pj_test',
        tenantType: 'business',
        taxIdType: 'CNPJ',
        taxIdMasked: '**.***.***/****-**',
        taxIdHash: 'hash',
        displayName: 'Teste',
        slug: 'teste',
        status: 'active',
        isolation: { strategy: 'collection_prefix', collectionPrefix: 'pj_test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await invalidateTenantRegistryCache('tenant_pj_test');
    } finally {
      if (previous === undefined) delete process.env.REDIS_ENABLED;
      else process.env.REDIS_ENABLED = previous;
    }
  });
});
