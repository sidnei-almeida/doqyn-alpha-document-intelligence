import type { VercelRequest, VercelResponse } from '@vercel/node';
import { userIsCompanyAdmin } from '../auth/memberAuth.js';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import { requireAuth } from '../auth/requireAuth.js';
import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { userGovernsTenantConfiguration } from '../tenancy/documentAccess.js';
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

/**
 * - `tenant_configuration` (padrão): leitura para qualquer membro, escrita só para quem governa o
 *   tenant (`userGovernsTenantConfiguration`).
 * - `user_management`: tudo, inclusive leitura, só para `company_admin`.
 */
export type AdminApiAccess = 'tenant_configuration' | 'user_management';

const READ_METHODS = new Set(['GET', 'HEAD']);

const FORBIDDEN_RESULT: AdminApiResult = {
  status: 403,
  body: { message: 'Sem permissão para esta operação.', code: 'FORBIDDEN' },
};

/**
 * `null` quando a sessão pode usar a rota; senão, a recusa pronta para responder.
 *
 * Este wrapper se chamava "admin" e só exigia login. Qualquer membro alterava grupo de documentos,
 * regra de acesso e a própria participação em grupo — que é o que decide quem vê cada documento.
 * Escrita agora é negada por padrão.
 */
export function resolveAdminApiDenial(
  method: string | undefined,
  user: AuthUser,
  access: AdminApiAccess = 'tenant_configuration',
): AdminApiResult | null {
  if (access === 'user_management') {
    return userIsCompanyAdmin(user) ? null : FORBIDDEN_RESULT;
  }
  if (READ_METHODS.has((method ?? 'GET').toUpperCase())) return null;
  return userGovernsTenantConfiguration(user) ? null : FORBIDDEN_RESULT;
}

export async function withAdminMongoApi(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    endpoint: string;
    access?: AdminApiAccess;
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

  const denial = resolveAdminApiDenial(req.method, user, options.access);
  if (denial) {
    logger.warn(`${options.endpoint} forbidden`, {
      requestId: ctx.requestId,
      method: req.method,
      access: options.access ?? 'tenant_configuration',
      durationMs: Date.now() - startedAt,
    });
    res.status(denial.status ?? 403).json(denial.body);
    return;
  }

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
