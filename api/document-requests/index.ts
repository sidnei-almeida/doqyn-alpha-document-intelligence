import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentRequest,
  listDocumentRequests,
} from '../../server/services/requests/documentRequestService.js';
import type { DocumentRequestStatus } from '../../server/db/types.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../server/services/tracking/trackingService.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

const STATUSES = new Set<DocumentRequestStatus>(['pending', 'fulfilled', 'cancelled', 'expired']);

function readStatus(raw: unknown): DocumentRequestStatus | undefined {
  return typeof raw === 'string' && STATUSES.has(raw as DocumentRequestStatus)
    ? (raw as DocumentRequestStatus)
    : undefined;
}

/**
 * Pedir um documento a alguém, e ver os pedidos.
 *
 * Diferente da fila de aprovações, esta lista é de qualquer pessoa: não há verificação de papel
 * administrativo, porque pedir um documento não é um ato de governança — é trabalho do dia.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    if (req.method === 'GET') {
      const limitRaw = Number(req.query.limit);
      const result = await listDocumentRequests({
        tenantId: auth.ctx.tenantId,
        userId: auth.ctx.userId,
        // O padrão é o que me pediram: é a lista com trabalho a fazer.
        direction: req.query.direction === 'sent' ? 'sent' : 'received',
        status: readStatus(req.query.status),
        limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const request = await createDocumentRequest(auth.ctx, auth.user, {
        requestedFromUserId:
          typeof body.requestedFromUserId === 'string' ? body.requestedFromUserId : undefined,
        // O caminho que atravessa a fronteira: o servidor resolve se é de casa ou de fora.
        requestedFromEmail:
          typeof body.requestedFromEmail === 'string' ? body.requestedFromEmail : undefined,
        requestedFromUsername:
          typeof body.requestedFromUsername === 'string' ? body.requestedFromUsername : undefined,
        title: typeof body.title === 'string' ? body.title : '',
        description: typeof body.description === 'string' ? body.description : undefined,
        categoryId: typeof body.categoryId === 'string' ? body.categoryId : undefined,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : undefined,
      });

      await emitTrackingEvent(
        buildDocumentAuditContext(auth.ctx, auth.user),
        {
          action: 'document_request.created',
          description: 'Documento requisitado a um usuário.',
          metadata: sanitizeAuditMetadata({
            requestId: request._id,
            requestedFromUserId: request.requestedFrom.userId,
            categoryId: request.categoryId,
            dueAt: request.dueAt?.toISOString(),
          }),
        },
        req,
      );

      return res.status(201).json({ request });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
