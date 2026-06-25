import type { VercelRequest } from '@vercel/node';
import { ServiceError } from '../utils/serviceErrors.js';

function readInternalApiKey(): string {
  const key = process.env.DOQYN_APP_INTERNAL_API_KEY?.trim();
  if (!key) {
    throw new ServiceError(
      'DOQYN_APP_INTERNAL_API_KEY não configurada.',
      'INTERNAL_API_MISCONFIGURED',
      500,
    );
  }
  return key;
}

export function assertAppInternalApiKey(req: VercelRequest): void {
  const expected = readInternalApiKey();
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token || token !== expected) {
    throw new ServiceError('Não autorizado.', 'UNAUTHORIZED', 401);
  }
}
