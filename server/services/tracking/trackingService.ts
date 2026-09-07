import type { VercelRequest } from '@vercel/node';
import { createDocumentAuditLog } from '../../audit/documentAuditLogService.js';
import type {
  DocumentAuditContext,
  DocumentAuditEventInput,
} from '../../audit/documentAuditTypes.js';
import { sanitizeAuditMetadata } from '../../utils/sanitizeAuditMetadata.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  buildSecurityAuditRestricted,
  buildSecurityContext,
  resolveClientIp,
  securityContextToLegacySnapshot,
} from './securityContext.js';
import {
  CLIENT_TRACKING_ACTIONS,
  resolveTrackingActionGroup,
  resolveTrackingEventStatus,
  type TrackingEventStatus,
} from './trackingTypes.js';

export type EmitTrackingEventInput = DocumentAuditEventInput & {
  status?: TrackingEventStatus;
  actionGroup?: string;
  security?: Record<string, unknown>;
};

function isAccessDeniedCode(code?: string): boolean {
  return (
    code === 'DOCUMENT_ACCESS_DENIED' ||
    code === 'DOCUMENT_FORBIDDEN' ||
    code === 'FORBIDDEN' ||
    code === 'FORBIDDEN_COMPANY'
  );
}

function resolveIsExternalGuest(
  event: EmitTrackingEventInput,
  metadata: Record<string, unknown> | undefined,
): boolean {
  if (event.security?.isExternalGuest === true) return true;
  const source = typeof metadata?.source === 'string' ? metadata.source : '';
  if (source === 'external_share' || source === 'guest_portal' || source === 'signature_portal') {
    return true;
  }
  const signerType = typeof metadata?.signerType === 'string' ? metadata.signerType : '';
  return signerType === 'external_guest';
}

function buildEventSecurityContext(
  ctx: DocumentAuditContext,
  event: EmitTrackingEventInput,
  req?: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
) {
  const clientIp = req ? resolveClientIp(req) : undefined;
  const isExternalGuest = resolveIsExternalGuest(event, event.metadata);
  const securityOverrides = (event.security ?? {}) as Record<string, unknown>;

  const securityContext = buildSecurityContext(req, {
    requestId: ctx.requestId,
    authMethod:
      typeof securityOverrides.authMethod === 'string' ? securityOverrides.authMethod : undefined,
    isExternalGuest,
    permissionResult:
      securityOverrides.permissionResult === 'allowed' ||
      securityOverrides.permissionResult === 'denied'
        ? securityOverrides.permissionResult
        : undefined,
    permissionReason:
      typeof securityOverrides.permissionReason === 'string'
        ? securityOverrides.permissionReason
        : undefined,
    requiredPermission:
      typeof securityOverrides.requiredPermission === 'string'
        ? securityOverrides.requiredPermission
        : undefined,
    _clientIp: clientIp,
  });

  const securityAuditRestricted = buildSecurityAuditRestricted(clientIp);
  const legacySecurity = securityContextToLegacySnapshot(securityContext);

  return { securityContext, securityAuditRestricted, legacySecurity };
}

/** Emite evento de tracking sem derrubar o fluxo principal. */
export async function emitTrackingEvent(
  ctx: DocumentAuditContext,
  event: EmitTrackingEventInput,
  req?: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
): Promise<{ id: string } | null> {
  try {
    const status = event.status ?? resolveTrackingEventStatus(event.action, event.result);
    const actionGroup = event.actionGroup ?? resolveTrackingActionGroup(event.action);
    const { securityContext, securityAuditRestricted, legacySecurity } = buildEventSecurityContext(
      ctx,
      event,
      req,
    );

    // Quanto o request levou até este evento. Sem isto a coluna de duração da
    // trilha ficava vazia em todo evento que não fosse de análise — e um log de
    // acesso sem tempo não responde "o download demorou porque o arquivo é
    // grande ou porque o storage engasgou?".
    const durationMs =
      typeof event.metadata?.durationMs === 'number'
        ? event.metadata.durationMs
        : typeof ctx.startedAt === 'number'
          ? Math.max(0, Date.now() - ctx.startedAt)
          : undefined;

    const metadata = sanitizeAuditMetadata({
      status,
      actionGroup,
      securityContext,
      security: legacySecurity,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(securityAuditRestricted ? { securityAuditRestricted } : {}),
      ...(event.metadata ?? {}),
    });

    return await createDocumentAuditLog(ctx, {
      ...event,
      result: event.result ?? (status === 'failed' || status === 'denied' ? 'error' : 'success'),
      metadata,
    });
  } catch {
    return null;
  }
}

export async function emitAccessDeniedEvent(
  ctx: DocumentAuditContext,
  req: (Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] }) | undefined,
  input: {
    action?: string;
    documentId?: string;
    versionId?: string;
    reason: string;
    code?: string;
    requiredPermission?: string;
    targetName?: string;
  },
): Promise<void> {
  const action = input.action ?? 'access.document_denied';
  await emitTrackingEvent(
    ctx,
    {
      action,
      severity: 'warning',
      status: 'denied',
      description: 'Acesso ao documento negado.',
      documentId: input.documentId,
      versionId: input.versionId,
      target: input.documentId
        ? { type: 'document', id: input.documentId, nameSnapshot: input.targetName }
        : undefined,
      result: 'error',
      metadata: sanitizeAuditMetadata({
        reason: input.reason,
        code: input.code,
        requiredPermission: input.requiredPermission,
        source: 'api',
      }),
      security: buildSecurityContext(req, {
        permissionResult: 'denied',
        permissionReason: input.reason,
        requiredPermission: input.requiredPermission,
        requestId: ctx.requestId,
        isExternalGuest: false,
        authMethod: 'session',
      }),
    },
    req,
  );
}

/**
 * Falha ao servir um documento — a tentativa que não deu certo.
 *
 * Um preview que não abre é exatamente o que a trilha precisa mostrar: houve
 * tentativa, houve erro, o resultado não é sucesso. Sem isto, a única coisa que
 * ficava registrada era o acesso negado por permissão; arquivo corrompido,
 * storage fora do ar ou versão apagada sumiam da história, e a investigação via
 * um documento que ninguém nunca tentou abrir.
 */
export async function emitDocumentFailureEvent(
  ctx: DocumentAuditContext,
  req: (Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] }) | undefined,
  input: {
    action: string;
    description: string;
    documentId?: string;
    versionId?: string;
    error: unknown;
    source?: string;
    documentName?: string;
  },
): Promise<void> {
  const { message, code } = extractServiceErrorInfo(input.error);
  const statusCode =
    input.error && typeof input.error === 'object' && 'statusCode' in input.error
      ? (input.error as { statusCode?: number }).statusCode
      : undefined;

  await emitTrackingEvent(
    ctx,
    {
      action: input.action,
      severity: 'error',
      status: 'failed',
      result: 'error',
      description: input.description,
      documentId: input.documentId,
      versionId: input.versionId,
      target: input.documentId
        ? { type: 'document', id: input.documentId, nameSnapshot: input.documentName }
        : undefined,
      metadata: sanitizeAuditMetadata({
        ...(input.documentName ? { documentName: input.documentName } : {}),
        reason: message,
        code,
        statusCode,
        source: input.source ?? 'api',
      }),
    },
    req,
  );
}

export async function emitClientTrackingEvent(
  ctx: DocumentAuditContext,
  req: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
  input: {
    action: string;
    documentId?: string;
    versionId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string } | null> {
  if (!CLIENT_TRACKING_ACTIONS.has(input.action)) {
    throw new ServiceError('Ação de tracking não permitida.', 'TRACKING_ACTION_FORBIDDEN', 400);
  }

  const metadata = sanitizeAuditMetadata({
    source: 'client',
    ...(input.metadata ?? {}),
  });

  return emitTrackingEvent(
    ctx,
    {
      action: input.action,
      description: `Evento do cliente: ${input.action}`,
      documentId: input.documentId,
      versionId: input.versionId,
      metadata,
    },
    req,
  );
}

export function shouldEmitAccessDeniedFromError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const serviceError = error as { statusCode?: number; code?: string };
  return serviceError.statusCode === 403 || isAccessDeniedCode(serviceError.code);
}

export function extractServiceErrorInfo(error: unknown): { message: string; code?: string } {
  if (error && typeof error === 'object' && 'message' in error) {
    const record = error as { message: unknown; code?: unknown };
    return {
      message: String(record.message),
      code: typeof record.code === 'string' ? record.code : undefined,
    };
  }
  return { message: 'Acesso negado.' };
}
