import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listFrequentContacts } from '../../server/services/directory/contactAffinityService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

/**
 * Com quem quem está pedindo já trocou documento, do mais acionado para o menos.
 *
 * Sem teto de consulta próprio: ao contrário de `/api/directory/search`, aqui não se descobre
 * ninguém novo. A resposta é o histórico de quem pergunta, e varrê-la não revela nada que essa
 * pessoa já não tenha visto acontecer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const rawScope = typeof req.query.scope === 'string' ? req.query.scope : 'all';
  const scope =
    rawScope === 'internal' || rawScope === 'external' || rawScope === 'all' ? rawScope : 'all';

  const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
  const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;

  try {
    const contacts = await listFrequentContacts(auth.ctx, auth.user, { scope, limit });
    return res.status(200).json({ contacts, total: contacts.length });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
