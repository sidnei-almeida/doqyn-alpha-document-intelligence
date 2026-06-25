import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertCanManageCompany, resolveTargetCompanyId } from '../auth/memberAuth.js';
import { requireAuth, requireUserManager } from '../auth/requireAuth.js';
import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { extractRequestContext } from './requestContext.js';
import { logger } from './logger.js';
import { isServiceError } from './serviceErrors.js';
import { ServiceError } from './serviceErrors.js';

export type UserManagementContext = {
  requestId: string;
  companyId: string;
  user: AuthUser;
  params: Record<string, string>;
};

export async function withUserManagementApi(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    endpoint: string;
    handler: (ctx: UserManagementContext) => Promise<unknown>;
    resolveCompanyId?: (ctx: UserManagementContext) => string;
  },
): Promise<void> {
  const ctx = extractRequestContext(req);
  const startedAt = Date.now();
  const params = { ...req.query } as Record<string, string>;

  if (!isMongoNativeConfigured()) {
    res.status(503).json({
      message: 'Persistência indisponível. Configure MONGODB_URI no servidor.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!requireUserManager(user, res)) return;

  const companyId = options.resolveCompanyId
    ? options.resolveCompanyId({ requestId: ctx.requestId, companyId: user.companyId, user, params })
    : resolveTargetCompanyId(user, (req.body as { companyId?: string })?.companyId);

  try {
    assertCanManageCompany(user, companyId);
  } catch {
    res.status(403).json({ message: 'Sem permissão para esta empresa.', code: 'FORBIDDEN_COMPANY' });
    return;
  }

  try {
    const result = await options.handler({
      requestId: ctx.requestId,
      companyId,
      user,
      params,
    });

    logger.info(`${options.endpoint} completed`, {
      requestId: ctx.requestId,
      companyId,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof Error && error.message === 'FORBIDDEN_COMPANY_SCOPE') {
      res.status(403).json({ message: 'Sem permissão para esta empresa.', code: 'FORBIDDEN_COMPANY' });
      return;
    }
    logger.error(`${options.endpoint} failed`, {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    res.status(500).json({ message: 'Não foi possível concluir a operação.' });
  }
}

export function memberRouteCompanyResolver(ctx: UserManagementContext): string {
  const bodyCompanyId =
    typeof (ctx as UserManagementContext & { body?: { companyId?: string } }).body?.companyId ===
    'string'
      ? (ctx as UserManagementContext & { body?: { companyId?: string } }).body!.companyId
      : undefined;
  return resolveTargetCompanyId(ctx.user, bodyCompanyId ?? ctx.params.companyId);
}

export function rethrowServiceError(error: unknown): never {
  if (error instanceof ServiceError) throw error;
  throw error;
}
