import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSignOgMetadata } from '../../../../server/og/ogPortalMetadata.js';
import { renderOgPortalHtml } from '../../../../server/og/renderOgPortalHtml.js';
import { resolvePublicAppOrigin } from '../../../../server/utils/publicAppUrl.js';

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

  const origin = resolvePublicAppOrigin(req);
  const metadata = await getSignOgMetadata(token, origin);
  const html = renderOgPortalHtml(metadata);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}
