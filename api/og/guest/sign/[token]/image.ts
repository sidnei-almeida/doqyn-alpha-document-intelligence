import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveSignOgImage } from '../../../../../server/og/ogPortalImage.js';

function resolveToken(req: VercelRequest): string | undefined {
  const value = req.query.token;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_TOKEN' });
  }

  const image = await resolveSignOgImage(token);
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=600, stale-while-revalidate=1800');
  res.setHeader('ETag', image.cacheTag);
  return res.status(200).send(image.buffer);
}
