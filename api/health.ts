import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfiguredDatabaseName, env, isMongoConfigured } from '../server/utils/env.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.APP_ENV,
    database: isMongoConfigured() ? getConfiguredDatabaseName() : 'simulated',
  });
}
