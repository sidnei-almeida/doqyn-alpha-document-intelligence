import mongoose from 'mongoose';
import { env, isMongoConfigured } from '../utils/env.js';
import { logger } from '../utils/logger.js';

interface MongoCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoCache: MongoCache | undefined;
}

const cache: MongoCache = global._mongoCache ?? { conn: null, promise: null };
global._mongoCache = cache;

export async function connectMongo(): Promise<typeof mongoose | null> {
  if (!isMongoConfigured()) {
    logger.warn('MongoDB não configurado — operando em modo simulado');
    return null;
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI!, {
      dbName: env.MONGODB_DB_NAME,
    });
  }

  try {
    cache.conn = await cache.promise;
    logger.info('Conectado ao MongoDB', { db: env.MONGODB_DB_NAME });
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    logger.error('Falha ao conectar ao MongoDB', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
