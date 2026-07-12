import { getDoqynAuthBaseUrl } from '../auth/authConfig.js';
import { resolveAnalysisProvider } from '../ai/providers/resolveAnalysisProvider.js';
import { isRedisConfigured, redisPing } from '../redis/redisClient.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import { isStorageConfigured } from '../storage/index.js';
import { getAnalysisQueueStats, isAnalysisQueueEnabled } from '../queues/analysisQueue.js';
import { getPhaseAMetricsSnapshot } from '../metrics/phaseAMetrics.js';

export type HealthCheckResult = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  waiting?: number;
  active?: number;
  name?: string;
  configured?: boolean;
};

export type DeepHealthReport = {
  status: 'ok' | 'degraded' | 'down';
  checks: {
    mongo: HealthCheckResult;
    redis: HealthCheckResult;
    r2: HealthCheckResult;
    auth: HealthCheckResult;
    analysisQueue: HealthCheckResult;
    aiProvider: HealthCheckResult;
  };
  metrics: ReturnType<typeof getPhaseAMetricsSnapshot>;
  timestamp: string;
};

async function checkMongo(): Promise<HealthCheckResult> {
  if (!isMongoNativeConfigured()) {
    return { ok: false, message: 'MONGODB_URI não configurada' };
  }

  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'mongo ping failed',
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  if (!isRedisConfigured()) {
    return { ok: false, message: 'Redis desabilitado ou REDIS_URL ausente' };
  }

  const startedAt = Date.now();
  const ok = await redisPing();
  return {
    ok,
    latencyMs: Date.now() - startedAt,
    message: ok ? undefined : 'redis ping failed',
  };
}

async function checkStorage(): Promise<HealthCheckResult> {
  const configured = isStorageConfigured();
  return {
    ok: configured,
    configured,
    message: configured ? undefined : 'Storage não configurado',
  };
}

async function checkAuth(): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${getDoqynAuthBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return {
      ok: response.ok,
      latencyMs: Date.now() - startedAt,
      message: response.ok ? undefined : `auth health ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'auth unreachable',
    };
  }
}

async function checkAnalysisQueue(): Promise<HealthCheckResult> {
  if (!isAnalysisQueueEnabled()) {
    return { ok: false, message: 'Fila de análise desabilitada' };
  }

  try {
    const stats = await getAnalysisQueueStats();
    return {
      ok: true,
      waiting: stats.waiting,
      active: stats.active,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'queue stats failed',
    };
  }
}

function checkAiProvider(): HealthCheckResult {
  const provider = resolveAnalysisProvider();
  return {
    ok: provider.isConfigured(),
    name: provider.name,
    configured: provider.isConfigured(),
    message: provider.isConfigured() ? undefined : 'Provedor de IA não configurado',
  };
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function resolveOverallStatus(checks: DeepHealthReport['checks']): DeepHealthReport['status'] {
  if (!checks.mongo.ok) return 'down';

  const redisExpected = isRedisConfigured();
  const redisDown = redisExpected && !checks.redis.ok;
  const authDown = !checks.auth.ok;
  const queueExpected = isAnalysisQueueEnabled();
  const queueDown = queueExpected && !checks.analysisQueue.ok;
  const aiDown = isProductionRuntime() && !checks.aiProvider.ok;
  const storageDown = isProductionRuntime() && !checks.r2.ok;

  if (redisDown || authDown || queueDown || aiDown || storageDown) return 'degraded';
  return 'ok';
}

export async function runDeepHealthCheck(): Promise<DeepHealthReport> {
  const [mongo, redis, r2, auth, analysisQueue] = await Promise.all([
    checkMongo(),
    checkRedis(),
    checkStorage(),
    checkAuth(),
    checkAnalysisQueue(),
  ]);

  const aiProvider = checkAiProvider();
  const checks = { mongo, redis, r2, auth, analysisQueue, aiProvider };

  return {
    status: resolveOverallStatus(checks),
    checks,
    metrics: getPhaseAMetricsSnapshot(),
    timestamp: new Date().toISOString(),
  };
}
