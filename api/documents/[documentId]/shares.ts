import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  createDocumentShareGrant,
  listDocumentShareGrants,
} from '../../../server/services/sharing/documentShareService.js';
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

function readCreateBody(req: VercelRequest) {
  const body = req.body as {
    sharedWithUserId?: unknown;
    permissions?: { canView?: boolean; canDownload?: boolean };
    message?: unknown;
  };
  return {
    sharedWithUserId:
      typeof body?.sharedWithUserId === 'string' ? body.sharedWithUserId : undefined,
    permissions: body?.permissions,
    message: typeof body?.message === 'string' ? body.message : undefined,
  };
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
    if (req.method === 'GET') {
      const result = await listDocumentShareGrants(auth.ctx, auth.user, documentId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = readCreateBody(req);
      if (!body.sharedWithUserId?.trim()) {
        return res.status(400).json({
          message: 'sharedWithUserId é obrigatório.',
          code: 'MISSING_SHARED_WITH_USER',
        });
      }

      const result = await createDocumentShareGrant(auth.ctx, auth.user, documentId, {
        sharedWithUserId: body.sharedWithUserId,
        permissions: body.permissions,
        message: body.message,
      });

      if (!result.updated) {
        await emitTrackingEvent(
          auditCtx,
          {
            action: 'document.share_created',
            description: 'Documento compartilhado com usuário.',
            documentId,
            versionId: result.currentVersionId,
            metadata: sanitizeAuditMetadata({
              source: 'api',
              sharedWithUserId: result.sharedWithUserId,
              permissions: result.permissions,
            }),
          },
          req,
        );
      }

      return res.status(result.updated ? 200 : 201).json(result);
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
