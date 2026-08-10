import type { MongoTenant } from '../db/types.js';
import {
  redisDel,
  redisExistsAny,
  redisGetJson,
  redisSetJson,
  redisSetRaw,
} from '../redis/redisClient.js';

/**
 * Cache do documento de tenant do registry (`tenants`).
 *
 * `resolveTenant()` roda em praticamente toda requisição autenticada e, com o Mongo no Atlas,
 * cada leitura paga latência de rede. O cache é keyed por `tenantId` **e** por `companyId`,
 * porque os dois resolvem o mesmo documento.
 *
 * Invalidação é explícita (ver `invalidateTenantRegistryCache`): TTL sozinho não basta para
 * mudança de quota ou de bucket, que precisam valer na requisição seguinte.
 */

const DEFAULT_TTL_SECONDS = 90;

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function isTenantRegistryCacheEnabled(): boolean {
  return readBool(process.env.TENANT_REGISTRY_CACHE_ENABLED, true);
}

export function getTenantRegistryCacheTtlSeconds(): number {
  return readPositiveInt(process.env.TENANT_REGISTRY_CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

function buildKey(lookupId: string): string {
  return `tenant:registry:${lookupId}`;
}

/**
 * Marca de invalidação recente. Vive pouco: só precisa durar mais que uma consulta ao Atlas já em
 * andamento, para que ela não regrave o documento que acabou de ser invalidado.
 */
function buildInvalidationMarkKey(lookupId: string): string {
  return `tenant:registry:invalidated:${lookupId}`;
}

const INVALIDATION_MARK_TTL_SECONDS = 15;

function reviveDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * O round-trip por JSON transforma `Date` em string. Reidrata os campos de data conhecidos
 * para que o documento cacheado seja intercambiável com o vindo do driver.
 *
 * Campo ausente continua ausente: coagir para epoch faria um tenant legado sem `createdAt`
 * aparecer como 01/01/1970 no caminho cacheado e vazio no caminho direto.
 */
function reviveTenant(raw: MongoTenant): MongoTenant {
  const tenant: MongoTenant = { ...raw };

  const createdAt = reviveDate(raw.createdAt);
  const updatedAt = reviveDate(raw.updatedAt);
  if (createdAt) tenant.createdAt = createdAt;
  else delete (tenant as Partial<MongoTenant>).createdAt;
  if (updatedAt) tenant.updatedAt = updatedAt;
  else delete (tenant as Partial<MongoTenant>).updatedAt;

  if (tenant.storage) {
    const { bucketCreatedAt, bucketLastCheckedAt, ...rest } = tenant.storage;
    tenant.storage = {
      ...rest,
      ...(reviveDate(bucketCreatedAt) ? { bucketCreatedAt: reviveDate(bucketCreatedAt) } : {}),
      ...(reviveDate(bucketLastCheckedAt)
        ? { bucketLastCheckedAt: reviveDate(bucketLastCheckedAt) }
        : {}),
    };
  }

  return tenant;
}

/** Chaves sob as quais o documento é indexado — `tenantId` e o alias legado `companyId`. */
function lookupKeysFor(tenant: MongoTenant): string[] {
  const keys = new Set<string>([tenant.tenantId]);
  if (tenant.companyId) keys.add(tenant.companyId);
  return [...keys];
}

export async function getCachedTenant(lookupId: string): Promise<MongoTenant | null> {
  if (!isTenantRegistryCacheEnabled()) return null;

  const cached = await redisGetJson<MongoTenant>(buildKey(lookupId));
  if (!cached) return null;

  return reviveTenant(cached);
}

export async function setCachedTenant(lookupId: string, tenant: MongoTenant): Promise<void> {
  if (!isTenantRegistryCacheEnabled()) return;

  const keys = [...new Set<string>([lookupId, ...lookupKeysFor(tenant)])];

  // Corrida a fechar: entre o `findOne` e este `set`, um writer pode ter invalidado o tenant. Sem
  // a marca, este request gravaria de volta o retrato velho e ele sobreviveria o TTL inteiro —
  // exatamente o que a invalidação explícita existe para impedir.
  if (await redisExistsAny(...keys.map(buildInvalidationMarkKey))) return;

  const ttl = getTenantRegistryCacheTtlSeconds();

  // `redisSetJson` engole falha de escrita: com `maxmemory-policy noeviction` o Redis cheio
  // recusa a escrita, e isso não pode derrubar o request — só significa "não cacheou".
  await Promise.all(keys.map((key) => redisSetJson(buildKey(key), tenant, ttl)));
}

/**
 * Remove o documento do cache.
 *
 * Aceita `tenantId` ou `companyId`. Como o documento é gravado sob os dois aliases, invalidar só o
 * id que o chamador tem em mãos deixaria o outro apontando para dado velho pelo TTL inteiro — daí
 * a leitura do documento cacheado para descobrir o alias irmão antes de apagar.
 */
export async function invalidateTenantRegistryCache(
  ...lookupIds: (string | undefined | null)[]
): Promise<void> {
  if (!isTenantRegistryCacheEnabled()) return;

  const ids = new Set(
    lookupIds
      .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      .map((id) => id.trim()),
  );

  if (ids.size === 0) return;

  for (const id of [...ids]) {
    const cached = await redisGetJson<MongoTenant>(buildKey(id));
    if (!cached) continue;
    for (const alias of lookupKeysFor(cached)) ids.add(alias);
  }

  const keys = [...ids];

  await Promise.all([
    redisDel(...keys.map(buildKey)),
    // A marca cobre o intervalo em que um `resolveTenant` já em voo pode regravar o retrato velho.
    ...keys.map((key) =>
      redisSetRaw(buildInvalidationMarkKey(key), '1', INVALIDATION_MARK_TTL_SECONDS),
    ),
  ]);
}
