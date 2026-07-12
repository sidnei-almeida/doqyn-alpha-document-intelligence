import { getRedisClient } from '../redis/redisClient.js';
import { prefixRedisKey } from '../redis/redisConfig.js';
import { getAnalysisQueueConcurrencyPerTenant } from './analysisQueue.js';

function tenantActiveKey(tenantId: string): string {
  return prefixRedisKey(`analysis:tenant:${tenantId}:active`);
}

/** Tenta reservar slot de concorrência por tenant. Sem Redis, sempre permite. */
export async function tryAcquireTenantAnalysisSlot(tenantId: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return true;

  const key = tenantActiveKey(tenantId);
  const limit = getAnalysisQueueConcurrencyPerTenant();
  const current = await client.incr(key);
  await client.expire(key, 7_200);

  if (current <= limit) return true;

  await client.decr(key);
  return false;
}

export async function releaseTenantAnalysisSlot(tenantId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const key = tenantActiveKey(tenantId);
  const current = await client.decr(key);
  if (current < 0) {
    await client.set(key, '0', 'EX', 7_200);
  }
}
