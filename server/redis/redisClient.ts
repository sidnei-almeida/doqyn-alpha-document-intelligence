import { Redis } from 'ioredis';
import {
  getRedisConnectTimeoutMs,
  getRedisMaxRetries,
  getRedisUrl,
  isRedisEnabled,
  prefixRedisKey,
} from './redisConfig.js';
import { logger } from '../utils/logger.js';

type RedisCache = {
  client: Redis | null;
  promise: Promise<Redis | null> | null;
};

declare global {
  var _doqynRedisCache: RedisCache | undefined;
}

const cache: RedisCache = global._doqynRedisCache ?? {
  client: null,
  promise: null,
};
global._doqynRedisCache = cache;

export function isRedisConfigured(): boolean {
  return isRedisEnabled() && Boolean(getRedisUrl());
}

export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisConfigured()) return null;
  if (cache.client) return cache.client;

  if (!cache.promise) {
    cache.promise = (async () => {
      const url = getRedisUrl();
      if (!url) return null;

      const client = new Redis(url, {
        maxRetriesPerRequest: getRedisMaxRetries(),
        connectTimeout: getRedisConnectTimeoutMs(),
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy(times: number) {
          return Math.min(times * 200, 3_000);
        },
      });

      client.on('error', (error: Error) => {
        logger.warn('Redis client error', {
          message: error instanceof Error ? error.message : 'unknown',
        });
      });

      try {
        await client.connect();
        logger.info('Redis connected');
        cache.client = client;
        return client;
      } catch (error) {
        logger.warn('Redis connection failed — usando fallback in-memory', {
          message: error instanceof Error ? error.message : 'unknown',
        });
        try {
          client.disconnect();
        } catch {
          // ignore
        }
        cache.client = null;
        return null;
      }
    })();
  }

  return cache.promise;
}

export async function connectRedisOnBoot(): Promise<void> {
  await getRedisClient();
}

export async function redisPing(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    const response = await client.ping();
    return response === 'PONG';
  } catch {
    return false;
  }
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(prefixRedisKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(prefixRedisKey(key), JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // cache miss on next read
  }
}

export async function redisGetNumber(key: string): Promise<number | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(prefixRedisKey(key));
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function redisExistsAny(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;
  const client = await getRedisClient();
  if (!client) return false;
  try {
    const found = await client.exists(...keys.map((key) => prefixRedisKey(key)));
    return found > 0;
  } catch {
    return false;
  }
}

export async function redisSetRaw(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(prefixRedisKey(key), value, 'EX', ttlSeconds);
  } catch {
    // com `noeviction` o Redis cheio recusa escrita — nunca pode derrubar o request
  }
}

export async function redisDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(...keys.map((key) => prefixRedisKey(key)));
  } catch {
    // sem Redis a leitura cai para o banco; a chave expira pelo TTL
  }
}

export async function redisIncrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const prefixed = prefixRedisKey(key);
  const value = await client.incr(prefixed);
  if (value === 1) {
    await client.expire(prefixed, ttlSeconds);
  }
  return value;
}

export async function closeRedis(): Promise<void> {
  if (cache.client) {
    await cache.client.quit();
  }
  cache.client = null;
  cache.promise = null;
}
