import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import { requireAuth } from '../auth/requireAuth.js';
import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { extractRequestContext } from './requestContext.js';
import { logger } from './logger.js';
import { isServiceError } from './serviceErrors.js';

export type AdminApiContext = {
  requestId: string;
  tenantId: string;
  /** @deprecated Use tenantId */
  companyId: string;
  user: AuthUser;
  params: Record<string, string>;
};

export type AdminApiResult = {
  status?: number;
  body: unknown;
};

export async function withAdminMongoApi(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    endpoint: string;
    handler: (ctx: AdminApiContext) => Promise<AdminApiResult | unknown>;
  },
): Promise<void> {
  const ctx = extractRequestContext(req);
  const startedAt = Date.now();
  const params = { ...req.query } as Record<string, string>;

  logger.info(`${options.endpoint} request started`, {
    requestId: ctx.requestId,
    method: req.method,
    endpoint: options.endpoint,
    resourceId: params.id,
  });

  if (!isMongoNativeConfigured()) {
    logger.warn(`${options.endpoint} unavailable`, {
      requestId: ctx.requestId,
      reason: 'mongodb_not_configured',
      durationMs: Date.now() - startedAt,
    });
    res.status(503).json({
      message: 'Persistência indisponível. Configure MONGODB_URI no servidor.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const tenantId = getTenantIdFromUser(user);
    const result = await options.handler({
      requestId: ctx.requestId,
      tenantId,
      companyId: tenantId,
      user,
      params,
    });

    logger.info(`${options.endpoint} request completed`, {
      requestId: ctx.requestId,
      tenantId,
      companyId: tenantId,
      endpoint: options.endpoint,
      resourceId: params.id,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    if (result !== undefined) {
      if (
        result &&
        typeof result === 'object' &&
        'body' in result &&
        (result as AdminApiResult).body !== undefined
      ) {
        const typed = result as AdminApiResult;
        res.status(typed.status ?? 200).json(typed.body);
      } else {
        res.status(200).json(result);
      }
    }
  } catch (error) {
    if (isServiceError(error)) {
      logger.warn(`${options.endpoint} controlled error`, {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      res.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }

    logger.error(`${options.endpoint} unexpected error`, {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    res.status(500).json({ message: 'Não foi possível concluir a operação.' });
  }
}

export function createdResponse(
  res: VercelResponse,
  requestId: string,
  payload: unknown,
): void {
  res.setHeader('X-DOQYN-Request-Id', requestId);
  res.status(201).json(payload);
}

export function apiCreated(body: unknown): AdminApiResult {
  return { status: 201, body };
}
