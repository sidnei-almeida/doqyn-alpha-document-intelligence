import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShareOgMetadata } from '../../../../server/og/ogPortalMetadata.js';
import { renderOgPortalHtml } from '../../../../server/og/renderOgPortalHtml.js';
import { resolvePublicAppOrigin } from '../../../../server/utils/publicAppUrl.js';

function resolveToken(req: VercelRequest): string | undefined {
  const value = req.query.token;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // HEAD junto com GET: o robô da Meta sonda o endereço antes de buscá-lo, para saber tipo e
  // tamanho, e um 405 nessa sondagem faz ele desistir da prévia sem nunca tentar o GET. Era por
  // isso que a mensagem saía mostrando só o domínio mesmo com as meta tags corretas.
  const isHead = req.method === 'HEAD';
  if (req.method !== 'GET' && !isHead) {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_SHARE_TOKEN' });
  }

  const origin = resolvePublicAppOrigin(req);
  const metadata = await getShareOgMetadata(token, origin);
  const html = renderOgPortalHtml(metadata);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // `public`: a página não fala mais do documento, então não há o que proteger de cache
  // intermediário — e é isso que permite ao robô guardar o resultado em vez de repetir a busca.
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.setHeader('Content-Length', String(Buffer.byteLength(html, 'utf8')));

  if (isHead) return res.status(200).end();
  return res.status(200).send(html);
}
