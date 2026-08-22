import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { listDocumentTimeline } from '../../server/audit/documentAuditLogService.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import {
  TRACKING_ACTION_GROUPS,
  TRACKING_EVENT_STATUSES,
  type TrackingActionGroup,
  type TrackingEventStatus,
} from '../../server/services/tracking/trackingTypes.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

function queryParam(req: VercelRequest, name: string): string | undefined {
  const raw = req.query[name];
  const value = typeof raw === 'string' ? raw.trim() : undefined;
  return value || undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const documentId =
    typeof req.query.documentId === 'string'
      ? req.query.documentId
      : typeof req.query.id === 'string'
        ? req.query.id
        : undefined;

  if (!documentId?.trim()) {
    return res.status(400).json({
      message: 'documentId é obrigatório.',
      code: 'MISSING_DOCUMENT_ID',
    });
  }

  // Rota sempre de um documento único: o escopo entra na guarda para que o dono veja a linha do
  // tempo do próprio documento sem governar o tenant (D-07).
  const auth = await requireDocumentTrackingAccess(req, res, { documentId: documentId.trim() });
  if (!auth) return;

  const limit =
    typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const actionPrefix =
    typeof req.query.actionPrefix === 'string' ? req.query.actionPrefix : undefined;
  const actionGroup = queryParam(req, 'actionGroup');
  const status = queryParam(req, 'status');
  const actorUserId = queryParam(req, 'actorUserId');
  const from = queryParam(req, 'from');
  const to = queryParam(req, 'to');

  // Filtro inválido é erro do chamador, não uma lista vazia silenciosa.
  if (actionGroup && !TRACKING_ACTION_GROUPS.includes(actionGroup as TrackingActionGroup)) {
    return res.status(400).json({
      message: `Grupo de ação inválido. Valores aceitos: ${TRACKING_ACTION_GROUPS.join(', ')}.`,
      code: 'INVALID_ACTION_GROUP',
    });
  }

  if (status && !TRACKING_EVENT_STATUSES.includes(status as TrackingEventStatus)) {
    return res.status(400).json({
      message: `Status inválido. Valores aceitos: ${TRACKING_EVENT_STATUSES.join(', ')}.`,
      code: 'INVALID_STATUS',
    });
  }

  for (const [name, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value && Number.isNaN(new Date(value).getTime())) {
      return res.status(400).json({
        message: `Data inválida em "${name}". Use ISO 8601.`,
        code: 'INVALID_DATE_RANGE',
      });
    }
  }

  try {
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
    const result = await listDocumentTimeline({
      ctx: auditCtx,
      documentId: documentId.trim(),
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
      actionPrefix,
      actionGroup,
      status,
      actorUserId,
      from,
      to,
    });

    return res.status(200).json({
      items: result.items,
      pagination: {
        nextCursor: result.nextCursor,
      },
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
