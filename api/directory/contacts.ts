import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  forgetContactDecision,
  hideContact,
  saveContactByEmail,
  saveContactByUsername,
} from '../../server/services/directory/savedContactsService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

/**
 * Salvar, ocultar e desfazer — as três decisões que a lista derivada não produz sozinha.
 *
 * `DELETE` aqui **não apaga histórico**: grava a decisão de não ver mais aquela linha. O que
 * responde auditoria continua onde estava; some o atalho, que é conveniência.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { username?: string; email?: string };

      if (body.username) {
        const saved = await saveContactByUsername(auth.ctx, auth.user, body.username);
        return res.status(201).json({ contact: saved });
      }

      if (body.email) {
        const saved = await saveContactByEmail(auth.ctx, auth.user, body.email);
        return res.status(201).json({ contact: saved });
      }

      return res.status(400).json({
        message: 'Informe o nome de usuário ou o e-mail.',
        code: 'CONTACT_TARGET_MISSING',
      });
    }

    if (req.method === 'DELETE') {
      const contactUserId =
        typeof req.query.contactUserId === 'string' ? req.query.contactUserId : '';
      // `undo` desfaz a decisão em vez de gravar outra: o contato volta a valer o que o histórico
      // disser sobre ele, que é o estado de quem nunca decidiu nada.
      const undo = req.query.undo === 'true';

      if (undo) {
        await forgetContactDecision(auth.user, contactUserId);
        return res.status(200).json({ ok: true });
      }

      const hidden = await hideContact(auth.ctx, auth.user, contactUserId);
      return res.status(200).json({ contact: hidden });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
