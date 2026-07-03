import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocumentDetail } from '../../server/services/documentService.js';
import {
  assertQueryTenantMatchesSession,
  requireDocumentAuthContext,
} from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId =
    (typeof req.query.documentId === 'string' ? req.query.documentId : undefined) ??
    (typeof req.query.id === 'string' ? req.query.id : undefined);

  if (!documentId?.trim()) {
    return res.status(400).json({
      message: 'documentId é obrigatório.',
      code: 'DOCUMENT_ID_REQUIRED',
    });
  }

  try {
    assertQueryTenantMatchesSession(
      typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
      auth.ctx,
    );

    const detail = await getDocumentDetail(
      documentId.trim(),
      auth.ctx.tenantId,
      auth.ctx.userId,
      auth.user,
      auth.ctx.membershipId,
    );

    if (!detail) {
      return res.status(404).json({
        message: 'Documento não encontrado.',
        code: 'DOCUMENT_NOT_FOUND',
      });
    }

    return res.status(200).json(detail);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
