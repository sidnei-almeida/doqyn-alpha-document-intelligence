import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoTenant } from '../db/types.js';
import { redisIncrWithTtl } from '../redis/redisClient.js';
import { recordQuotaExceeded } from '../metrics/phaseAMetrics.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TenantQuotaAction = 'analysis_per_day' | 'uploads_per_hour';

export type TenantQuotaLimits = {
  analysisPerDay: number;
  uploadsPerHour: number;
};

const DEFAULT_QUOTAS: TenantQuotaLimits = {
  analysisPerDay: 200,
  uploadsPerHour: 60,
};

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readQuotaLimitsFromEnv(): TenantQuotaLimits {
  return {
    analysisPerDay: readPositiveInt(process.env.TENANT_QUOTA_ANALYSIS_PER_DAY, DEFAULT_QUOTAS.analysisPerDay),
    uploadsPerHour: readPositiveInt(process.env.TENANT_QUOTA_UPLOADS_PER_HOUR, DEFAULT_QUOTAS.uploadsPerHour),
  };
}

function isTenantQuotaEnabled(): boolean {
  const raw = process.env.TENANT_QUOTA_ENABLED?.trim().toLowerCase();
  // Default OFF — exige opt-in explícito (precisa Redis para funcionar de verdade).
  if (!raw) return false;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

async function loadTenantQuotaOverrides(tenantId: string): Promise<Partial<TenantQuotaLimits>> {
  if (!isMongoNativeConfigured()) return {};

  const db = await getDb();
  const tenant = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .findOne({ tenantId }, { projection: { quotas: 1 } });

  const quotas = tenant?.quotas as Partial<TenantQuotaLimits> | undefined;
  return quotas ?? {};
}

export async function getTenantQuotaLimits(tenantId: string): Promise<TenantQuotaLimits> {
  const envDefaults = readQuotaLimitsFromEnv();
  const overrides = await loadTenantQuotaOverrides(tenantId);

  return {
    analysisPerDay: readPositiveInt(overrides.analysisPerDay, envDefaults.analysisPerDay),
    uploadsPerHour: readPositiveInt(overrides.uploadsPerHour, envDefaults.uploadsPerHour),
  };
}

function quotaWindowSeconds(action: TenantQuotaAction): number {
  return action === 'analysis_per_day' ? 86_400 : 3_600;
}

function quotaRedisKey(tenantId: string, action: TenantQuotaAction): string {
  const bucket = action === 'analysis_per_day' ? 'day' : 'hour';
  const now = new Date();
  const stamp =
    action === 'analysis_per_day'
      ? now.toISOString().slice(0, 10)
      : `${now.toISOString().slice(0, 13)}`;
  return `quota:${tenantId}:${action}:${bucket}:${stamp}`;
}

export async function assertTenantQuota(
  tenantId: string,
  action: TenantQuotaAction,
): Promise<void> {
  if (!isTenantQuotaEnabled()) return;

  const limits = await getTenantQuotaLimits(tenantId);
  const limit = action === 'analysis_per_day' ? limits.analysisPerDay : limits.uploadsPerHour;
  const ttlSeconds = quotaWindowSeconds(action);
  const key = quotaRedisKey(tenantId, action);

  const usage = await redisIncrWithTtl(key, ttlSeconds);
  if (usage === null) {
    // Fail-open: sem Redis não bloqueia análise/upload (dev local / Redis caído).
    // Em produção com multi-réplica, configure REDIS_URL + TENANT_QUOTA_ENABLED=true.
    return;
  }

  if (usage > limit) {
    recordQuotaExceeded(action);
    throw new ServiceError(
      'Limite de uso do tenant excedido. Tente novamente mais tarde.',
      'TENANT_QUOTA_EXCEEDED',
      429,
      { retryAfterSeconds: ttlSeconds },
    );
  }
}
