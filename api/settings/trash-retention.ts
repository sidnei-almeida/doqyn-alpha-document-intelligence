import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getTrashRetentionSettings,
  updateTrashRetentionSettings,
} from '../../server/services/trash/trashRetentionSettings.js';
import { userGovernsTenantScope } from '../../server/tenancy/documentAccess.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { ServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  // Governança de tenant, não de documento: o usuário único de um tenant PF configura a própria
  // lixeira sem depender de papel administrativo (T-01-10).
  if (!userGovernsTenantScope(auth.user, auth.ctx.storage)) {
    return res.status(403).json({
      message: 'Somente administradores podem alterar as configurações da lixeira.',
      code: 'TRASH_SETTINGS_FORBIDDEN',
    });
  }

  try {
    if (req.method === 'GET') {
      const settings = await getTrashRetentionSettings(auth.ctx.tenantId);
      return res.status(200).json({ settings });
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = req.body as {
        trashRetentionMode?: string;
        trashRetentionDays?: number;
      };

      const settings = await updateTrashRetentionSettings(auth.ctx.tenantId, {
        trashRetentionMode:
          body.trashRetentionMode === 'manual' || body.trashRetentionMode === 'days'
            ? body.trashRetentionMode
            : undefined,
        trashRetentionDays:
          typeof body.trashRetentionDays === 'number' ? body.trashRetentionDays : undefined,
      });

      return res.status(200).json({ settings });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (error instanceof ServiceError || isServiceError(error)) {
      const err = error as ServiceError;
      return res.status(err.statusCode).json({ message: err.message, code: err.code });
    }
    throw error;
  }
}
