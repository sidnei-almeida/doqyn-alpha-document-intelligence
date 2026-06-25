import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocument, listDocuments } from '../../server/services/documentService.js';
import {
  assertQueryTenantMatchesSession,
  requireDocumentRequestContext,
} from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const ctx = await requireDocumentRequestContext(req, res);
    if (!ctx) return;

    const { id, search, status, type, area, tenantId } = req.query;

    try {
      assertQueryTenantMatchesSession(
        typeof tenantId === 'string' ? tenantId : undefined,
        ctx,
      );

      if (id && typeof id === 'string') {
        const document = await getDocument(id, ctx.tenantId, ctx.userId);
        if (!document) return res.status(404).json({ message: 'Documento não encontrado' });
        return res.status(200).json({ document });
      }

      const result = await listDocuments({
        tenantId: ctx.tenantId,
        ownerUserId: ctx.userId,
        search: typeof search === 'string' ? search : undefined,
        status: typeof status === 'string' ? status : undefined,
        type: typeof type === 'string' ? type : undefined,
        area: typeof area === 'string' ? area : undefined,
      });

      return res.status(200).json(result);
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
