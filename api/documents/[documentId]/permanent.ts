import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Exclusão permanente descontinuada.
 * Fluxo: lixeira (TTL) → desativado (admin recupera). Storage/Mongo não são apagados.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return res.status(410).json({
    message:
      'Exclusão permanente descontinuada. Após o prazo na lixeira o documento é desativado; administradores podem recuperá-lo em Desativados.',
    code: 'PERMANENT_DELETE_DISABLED',
  });
}
