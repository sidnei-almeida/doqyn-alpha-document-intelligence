import { getRedisClient } from '../redis/redisClient.js';
import { prefixRedisKey } from '../redis/redisConfig.js';
import { getAnalysisQueueConcurrencyPerTenant } from './analysisQueue.js';

/**
 * Vaga de análise por tenant: uma reserva por job, com prazo.
 *
 * Era um contador — INCR ao pegar, DECR no `finally`. Worker que morria no meio (OOM, deploy sem
 * drenar) nunca devolvia a vaga, e toda tentativa recusada renovava o TTL da chave: o tenant ficava
 * sem análise até alguém apagar a chave à mão. Agora cada job é um membro de um sorted set cuja nota
 * é o vencimento da reserva. Vaga de job morto vence sozinha, e a retentativa do mesmo job reaproveita
 * a própria vaga em vez de ocupar outra.
 *
 * O prazo passa com folga a duração de uma análise. Se uma passar dele, o limite vira brando por um
 * instante — preferível a travar o tenant.
 */
const SLOT_LEASE_MS = 15 * 60_000;

function tenantLeasesKey(tenantId: string): string {
  return prefixRedisKey(`analysis:tenant:${tenantId}:leases`);
}

/** Atômico: limpa reservas vencidas, e só então decide se há vaga. */
const ACQUIRE_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttlSeconds = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
if redis.call('ZSCORE', key, member) or redis.call('ZCARD', key) < limit then
  redis.call('ZADD', key, expiresAt, member)
  redis.call('EXPIRE', key, ttlSeconds)
  return 1
end
return 0
`;

/** Tenta reservar vaga para o job. Sem Redis, sempre permite. */
export async function tryAcquireTenantAnalysisSlot(
  tenantId: string,
  jobId: string,
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return true;

  const now = Date.now();
  const granted = await client.eval(
    ACQUIRE_SLOT_SCRIPT,
    1,
    tenantLeasesKey(tenantId),
    now,
    now + SLOT_LEASE_MS,
    getAnalysisQueueConcurrencyPerTenant(),
    jobId,
    Math.ceil(SLOT_LEASE_MS / 1000),
  );
  return granted === 1;
}

export async function releaseTenantAnalysisSlot(tenantId: string, jobId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  await client.zrem(tenantLeasesKey(tenantId), jobId);
}
