import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanyIdFromUser } from '../../server/auth/companyContext.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { getActiveRulesPayload } from '../../server/services/documentRulesService.js';
import { extractRequestContext } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);
  const startedAt = Date.now();

  logger.info('document-rules/active request started', {
    requestId: ctx.requestId,
    endpoint: '/api/document-rules/active',
  });

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const companyId = getCompanyIdFromUser(user);
    const payload = await getActiveRulesPayload(companyId, { ownerUserId: user.id });

    logger.info('document-rules/active request completed', {
      requestId: ctx.requestId,
      ruleCount: Array.isArray(payload.classes) ? payload.classes.length : undefined,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('document-rules/active unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ message: 'Não foi possível carregar as regras ativas.' });
  }
}
