import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  createDocumentSignatureRequest,
  listDocumentSignatureRequests,
} from '../../../server/services/signatures/documentSignatureService.js';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    if (req.method === 'GET') {
      const result = await listDocumentSignatureRequests(auth.ctx, auth.user, documentId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = req.body as Record<string, unknown>;
      const result = await createDocumentSignatureRequest(
        auth.ctx,
        auth.user,
        documentId,
        {
          signerName: typeof body.signerName === 'string' ? body.signerName : '',
          signerEmail: typeof body.signerEmail === 'string' ? body.signerEmail : '',
          signerPhone: typeof body.signerPhone === 'string' ? body.signerPhone : undefined,
          signerOrganizationName:
            typeof body.signerOrganizationName === 'string' ? body.signerOrganizationName : undefined,
          signerType: body.signerType === 'internal_user' ? 'internal_user' : 'external_guest',
          signerUserId: typeof body.signerUserId === 'string' ? body.signerUserId : undefined,
          message: typeof body.message === 'string' ? body.message : undefined,
          expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
          permissions:
            body.permissions && typeof body.permissions === 'object'
              ? (body.permissions as {
                  canView?: boolean;
                  canSign?: boolean;
                  canDownloadAfterSign?: boolean;
                })
              : undefined,
        },
        resolveOrigin(req),
      );

      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.signature_request_created',
          description: 'Solicitação de assinatura eletrônica criada.',
          documentId,
          versionId: result.request.versionId,
          metadata: sanitizeAuditMetadata({
            signatureRequestId: result.request.signatureRequestId,
            signerType: body.signerType === 'internal_user' ? 'internal_user' : 'external_guest',
            source: 'signature_request',
          }),
        },
        req,
      );

      return res.status(201).json(result);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
