import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listDocumentVersions } from '../../../server/services/documentVersionService.js';
import {
  assertQueryTenantMatchesSession,
  requireDocumentAuthContext,
} from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromParams = (req as VercelRequest & { params?: { documentId?: string } }).params?.documentId;
  if (typeof fromParams === 'string' && fromParams.trim()) return fromParams.trim();
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  const fromId = req.query.id;
  if (typeof fromId === 'string' && fromId.trim()) return fromId.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);

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

    const result = await listDocumentVersions({
      documentId: documentId.trim(),
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
