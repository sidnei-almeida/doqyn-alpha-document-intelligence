import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertAppInternalApiKey } from '../../../server/auth/requireAppInternalApiKey.js';
import { isMongoNativeConfigured } from '../../../server/db/mongoClient.js';
import { provisionTenantEnvironment } from '../../../server/services/tenantProvisionService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { logger } from '../../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido' });
  }

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      ok: false,
      message: 'MongoDB não configurado.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  try {
    assertAppInternalApiKey(req);

    const body = (req.body ?? {}) as {
      tenantId?: string;
      tenantType?: 'business' | 'individual';
      displayName?: string;
      collectionPrefix?: string;
      createdByUserId?: string;
      createdByMembershipId?: string;
    };

    const tenantType = body.tenantType === 'individual' ? 'individual' : 'business';

    const result = await provisionTenantEnvironment({
      tenantId: body.tenantId ?? '',
      tenantType,
      displayName: body.displayName ?? '',
      collectionPrefix: body.collectionPrefix ?? (tenantType === 'individual' ? 'compartilhado' : body.tenantId ?? ''),
      createdByUserId: body.createdByUserId ?? '',
      createdByMembershipId: body.createdByMembershipId ?? '',
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
        code: error.code,
      });
    }

    logger.error('tenant provision unexpected error', {
      message: error instanceof Error ? error.message : 'unknown',
    });

    return res.status(500).json({
      ok: false,
      message: 'Falha no provisionamento do tenant.',
      code: 'PROVISIONING_FAILED',
    });
  }
}
