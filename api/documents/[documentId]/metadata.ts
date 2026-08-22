import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getDocumentMetadataSheet,
  updateDocumentMetadata,
} from '../../../server/services/expiry/documentMetadataEditService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = String(req.query.documentId ?? '').trim();
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  try {
    if (req.method === 'GET') {
      const sheet = await getDocumentMetadataSheet({
        tenantId: auth.ctx.tenantId,
        documentId,
        user: auth.user,
        userId: auth.ctx.userId,
        membershipId: auth.ctx.membershipId,
      });
      return res.status(200).json(sheet);
    }

    const body = (req.body ?? {}) as {
      fields?: Array<{ key?: unknown; label?: unknown; value?: unknown }>;
    };

    if (!Array.isArray(body.fields)) {
      return res.status(400).json({ message: 'fields é obrigatório.', code: 'VALIDATION_ERROR' });
    }

    const fields = body.fields.map((field) => ({
      key: String(field.key ?? ''),
      label: field.label === undefined ? undefined : String(field.label),
      value:
        field.value === null || field.value === undefined
          ? null
          : typeof field.value === 'number'
            ? field.value
            : String(field.value),
    }));

    const result = await updateDocumentMetadata({
      tenantId: auth.ctx.tenantId,
      documentId,
      user: auth.user,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      fields,
    });

    await emitTrackingEvent(
      buildDocumentAuditContext(auth.ctx, auth.user),
      {
        action: 'document.metadata.manually_edited',
        description: 'Metadados editados manualmente.',
        documentId,
        versionId: result.versionId,
        metadata: {
          updatedKeys: result.updatedKeys,
          removedKeys: result.removedKeys,
          validityDate: result.validityDate,
        },
      },
      req,
    );

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
