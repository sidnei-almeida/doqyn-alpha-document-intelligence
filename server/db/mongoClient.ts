import { MongoClient, type Db, type MongoClientOptions } from 'mongodb';
import { getMongoDatabaseName } from './database.js';
import { logger } from '../utils/logger.js';

interface MongoCache {
  client: MongoClient | null;
  db: Db | null;
  promise: Promise<Db> | null;
}

declare global {
  var _mongoNativeCache: MongoCache | undefined;
}

const cache: MongoCache = global._mongoNativeCache ?? {
  client: null,
  db: null,
  promise: null,
};
global._mongoNativeCache = cache;

export { getMongoDatabaseName } from './database.js';

export function isMongoNativeConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI não configurada no servidor.');
  }
  return uri;
}

function readPoolSize(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function getMongoClientOptions(): MongoClientOptions {
  return {
    maxPoolSize: readPoolSize(process.env.MONGODB_MAX_POOL_SIZE, 50),
    minPoolSize: readPoolSize(process.env.MONGODB_MIN_POOL_SIZE, 5),
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
  };
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;

  const client = new MongoClient(getMongoUri(), getMongoClientOptions());

  await client.connect();
  cache.client = client;
  logger.info('Conectado ao MongoDB Atlas', { database: getMongoDatabaseName() });
  return client;
}

export async function getDb(): Promise<Db> {
  if (cache.db) return cache.db;

  if (!cache.promise) {
    cache.promise = (async () => {
      const client = await getMongoClient();
      const db = client.db(getMongoDatabaseName());
      cache.db = db;
      return db;
    })();
  }

  return cache.promise;
}

export async function closeMongoConnection(): Promise<void> {
  if (cache.client) {
    await cache.client.close();
  }
  cache.client = null;
  cache.db = null;
  cache.promise = null;
}
