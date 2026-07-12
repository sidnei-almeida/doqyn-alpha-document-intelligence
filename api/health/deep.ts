import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runDeepHealthCheck } from '../../server/health/deepHealthCheck.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const report = await runDeepHealthCheck();
  const statusCode = report.status === 'down' ? 503 : 200;
  return res.status(statusCode).json(report);
}
