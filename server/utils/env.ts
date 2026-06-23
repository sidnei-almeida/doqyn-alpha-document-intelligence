import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().default('doqyn_alpha'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export const env = envSchema.parse({
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
  APP_ENV: process.env.APP_ENV,
});

export function isMongoConfigured(): boolean {
  return Boolean(env.MONGODB_URI);
}
