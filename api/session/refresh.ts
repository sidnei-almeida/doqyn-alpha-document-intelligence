import type { VercelRequest, VercelResponse } from '@vercel/node';
import { invalidateCachedDoqynSession } from '../../server/auth/sessionCache.js';
import { getDoqynSessionTokenFromRequest } from '../../server/auth/providers/doqynAuthProvider.js';

/**
 * Descarta a sessão em cache de quem chamou.
 *
 * O front edita conta falando direto com o `doqyn-auth-service`, então o alpha não fica sabendo
 * quando o idioma, o nome ou o avatar de alguém mudam — e continua servindo por até 45 segundos
 * a sessão que tinha em Redis. Esta rota é o aviso: "o que você guardou sobre mim está velho".
 *
 * Não recebe corpo nem devolve dado. Só apaga a chave do próprio chamador, identificada pelo
 * cookie de sessão que ele já mandou — não há como pedir o esquecimento da sessão alheia.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido.', code: 'METHOD_NOT_ALLOWED' });
  }

  const sessionToken = getDoqynSessionTokenFromRequest(req);
  if (!sessionToken) {
    return res.status(401).json({ message: 'Sessão não encontrada.', code: 'NO_SESSION' });
  }

  await invalidateCachedDoqynSession(sessionToken);
  return res.status(204).end();
}
