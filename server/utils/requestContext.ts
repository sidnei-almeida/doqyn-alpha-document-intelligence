import type { VercelRequest } from '@vercel/node';
import { randomUUID } from 'node:crypto';

export type RequestContext = {
  requestId: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
};

function readHeader(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export function getBearerAuthLogFields(req: VercelRequest): { hasBearerToken: boolean } {
  const value = req.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  const hasBearerToken =
    typeof header === 'string' && header.startsWith('Bearer ') && header.length > 20;

  return { hasBearerToken };
}

export function extractRequestContext(req: VercelRequest): RequestContext {
  return {
    requestId: readHeader(req, 'x-doqyn-request-id') ?? randomUUID(),
    batchId: readHeader(req, 'x-doqyn-batch-id'),
    itemId: readHeader(req, 'x-doqyn-item-id'),
    fileName: readHeader(req, 'x-doqyn-file-name'),
  };
}
