import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  createDocumentExternalShareGrant,
  listDocumentExternalShareGrants,
} from '../../../server/services/sharing/externalDocumentShareService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

function resolveOrigin(req: VercelRequest): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) return origin.trim();
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim()) {
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function readCreateBody(req: VercelRequest) {
  const body = req.body as {
    recipientEmail?: unknown;
    recipientPhone?: unknown;
    recipientName?: unknown;
    recipientOrganizationName?: unknown;
    recipientTaxId?: unknown;
    permissions?: { canView?: boolean; canDownload?: boolean };
    expiresAt?: unknown;
    message?: unknown;
  };
  return {
    recipientEmail: typeof body?.recipientEmail === 'string' ? body.recipientEmail : undefined,
    recipientPhone: typeof body?.recipientPhone === 'string' ? body.recipientPhone : undefined,
    recipientName: typeof body?.recipientName === 'string' ? body.recipientName : undefined,
    recipientOrganizationName:
      typeof body?.recipientOrganizationName === 'string'
        ? body.recipientOrganizationName
        : undefined,
    recipientTaxId: typeof body?.recipientTaxId === 'string' ? body.recipientTaxId : undefined,
    permissions: body?.permissions,
    expiresAt: typeof body?.expiresAt === 'string' ? body.expiresAt : undefined,
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
      const result = await listDocumentExternalShareGrants(auth.ctx, auth.user, documentId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = readCreateBody(req);
      if (!body.recipientEmail?.trim()) {
        return res.status(400).json({
          message: 'recipientEmail é obrigatório.',
          code: 'MISSING_RECIPIENT_EMAIL',
        });
      }

      const result = await createDocumentExternalShareGrant(auth.ctx, auth.user, documentId, {
        recipientEmail: body.recipientEmail,
        recipientPhone: body.recipientPhone,
        recipientName: body.recipientName,
        recipientOrganizationName: body.recipientOrganizationName,
        recipientTaxId: body.recipientTaxId,
        permissions: body.permissions,
        expiresAt: body.expiresAt,
        message: body.message,
        inviteOrigin: resolveOrigin(req),
      });

      if (!result.updated) {
        await emitTrackingEvent(
          auditCtx,
          {
            action: 'document.external_share_created',
            description: 'Compartilhamento externo criado.',
            documentId,
            versionId: result.currentVersionId,
            metadata: sanitizeAuditMetadata({
              source: 'api',
              shareId: result.shareId,
              recipientEmail: result.recipientEmail,
              recipientPhoneMasked: result.recipientPhoneMasked ?? undefined,
              permissions: result.permissions,
            }),
          },
          req,
        );
      }

      const { inviteToken, ...safeResult } = result;
      return res.status(result.updated ? 200 : 201).json({
        ...safeResult,
        inviteToken,
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
