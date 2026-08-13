import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertAppInternalApiKey } from '../../../server/auth/requireAppInternalApiKey.js';
import { isMongoNativeConfigured } from '../../../server/db/mongoClient.js';
import { revokeSharesGrantedByMembership } from '../../../server/services/sharing/membershipShareRevocationService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { logger } from '../../../server/utils/logger.js';

/**
 * Chamado pelo `doqyn-auth-service` quando um membership é removido ou bloqueado.
 *
 * O vínculo mora lá e os compartilhamentos moram aqui, então o corte precisa de um salto entre os
 * dois serviços — mesmo desenho de `/api/internal/tenants/provision`, autenticado pela chave
 * interna do app.
 */
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
      userId?: string;
      membershipId?: string;
      reason?: string;
    };

    const result = await revokeSharesGrantedByMembership({
      tenantId: body.tenantId ?? '',
      userId: body.userId ?? '',
      membershipId: body.membershipId,
      reason: body.reason,
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

    logger.error('membership share revocation unexpected error', {
      message: error instanceof Error ? error.message : 'unknown',
    });

    return res.status(500).json({
      ok: false,
      message: 'Falha ao revogar os compartilhamentos do membro.',
      code: 'SHARE_REVOCATION_FAILED',
    });
  }
}
