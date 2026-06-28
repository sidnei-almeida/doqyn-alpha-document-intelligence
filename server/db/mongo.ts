import mongoose from 'mongoose';
import { getMongoDatabaseName } from './database.js';
import { isMongoConfigured } from '../utils/env.js';
import { logger } from '../utils/logger.js';

interface MongoCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
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
    const dbName = getMongoDatabaseName();
    cache.promise = mongoose.connect(process.env.MONGODB_URI!, {
      dbName,
    });
  }

  try {
    cache.conn = await cache.promise;
    logger.info('Conectado ao MongoDB', { db: getMongoDatabaseName() });
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    logger.error('Falha ao conectar ao MongoDB', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
