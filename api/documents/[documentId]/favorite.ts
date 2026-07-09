import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  addDocumentFavorite,
  removeDocumentFavorite,
} from '../../../server/services/favorites/documentFavoritesService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  const fromId = req.query.id;
  if (typeof fromId === 'string' && fromId.trim()) return fromId.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);
  if (!documentId) {
    return res.status(400).json({
      message: 'documentId é obrigatório.',
      code: 'MISSING_DOCUMENT_ID',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    if (req.method === 'POST') {
      const result = await addDocumentFavorite(auth.ctx, auth.user, documentId);

      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.favorite_added',
          description: 'Documento adicionado aos favoritos.',
          documentId,
          metadata: sanitizeAuditMetadata({ source: 'api' }),
        },
        req,
      );

      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const result = await removeDocumentFavorite(auth.ctx, documentId);

      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.favorite_removed',
          description: 'Documento removido dos favoritos.',
          documentId,
          metadata: sanitizeAuditMetadata({ source: 'api' }),
        },
        req,
      );

      return res.status(200).json(result);
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
