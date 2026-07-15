import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { ServiceError } from '../utils/serviceErrors.js';

/** Comparação de tokens em tempo constante (evita timing attacks na chave interna). */
function safeTokenEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

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

  if (!token || !safeTokenEquals(token, expected)) {
    throw new ServiceError('Não autorizado.', 'UNAUTHORIZED', 401);
  }
}
