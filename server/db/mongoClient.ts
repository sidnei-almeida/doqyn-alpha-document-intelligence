import { MongoClient, type Db } from 'mongodb';
import { getMongoDatabaseName } from './database.js';
import {
  getMongoClientOptions,
  getMongoConnectionLabel,
} from './mongoConfig.js';
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

export { getMongoClientOptions } from './mongoConfig.js';
export { isMongoAtlasEnabled, isMongoAtlasUri } from './mongoConfig.js';

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;

  const client = new MongoClient(getMongoUri(), getMongoClientOptions());

  await client.connect();
  cache.client = client;
  logger.info(`Conectado ao ${getMongoConnectionLabel()}`, { database: getMongoDatabaseName() });
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
