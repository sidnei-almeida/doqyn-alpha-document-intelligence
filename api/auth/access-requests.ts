import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rejectLegacyAuthEndpoint } from '../../server/auth/legacyAuthGuard.js';
import { submitPublicAccessRequest } from '../../server/services/accessRequestService.js';
import { isMongoNativeConfigured } from '../../server/db/mongoClient.js';
import { extractRequestContext } from '../../server/utils/requestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);

  if (rejectLegacyAuthEndpoint(res, 'public_access_request')) {
    return;
  }

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      message: 'Serviço indisponível.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  try {
    const body = (req.body ?? {}) as {
      personType?: 'individual' | 'business';
      taxId?: string;
      tenantDisplayName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      whatsapp?: string;
      jobTitle?: string;
      departmentText?: string;
      reason?: string;
      operationalNotificationsConsent?: boolean;
    };

    const result = await submitPublicAccessRequest({
      personType: body.personType === 'individual' ? 'individual' : 'business',
      taxId: body.taxId ?? '',
      tenantDisplayName: body.tenantDisplayName ?? '',
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
      whatsapp: body.whatsapp ?? '',
      jobTitle: body.jobTitle ?? '',
      departmentText: body.departmentText ?? '',
      reason: body.reason ?? '',
      operationalNotificationsConsent: Boolean(body.operationalNotificationsConsent),
    });

    logger.info('public access request submitted', {
      requestId: ctx.requestId,
      personType: body.personType,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(201).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    logger.error('access request failed', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return res.status(500).json({ message: 'Não foi possível registrar a solicitação.' });
  }
}
