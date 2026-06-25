import { z } from 'zod';
import { getMongoDatabaseName } from '../db/database.js';

const envSchema = z.object({
  MONGODB_URI: z.string().optional(),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export const env = envSchema.parse({
  MONGODB_URI: process.env.MONGODB_URI,
  APP_ENV: process.env.APP_ENV,
});

export function isMongoConfigured(): boolean {
  return Boolean(env.MONGODB_URI);
}

export function getConfiguredDatabaseName(): string {
  return getMongoDatabaseName();
}
