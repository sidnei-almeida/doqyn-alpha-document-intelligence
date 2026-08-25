import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { TenantUploadPolicy } from '../../shared/uploadPolicy.js';
import {
  getTenantUploadPolicy,
  updateTenantUploadPolicy,
} from '../../server/services/settings/uploadPolicySettings.js';
import { userGovernsTenantScope } from '../../server/tenancy/documentAccess.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError, ServiceError } from '../../server/utils/serviceErrors.js';

/**
 * Política de upload/IA é da organização: qualquer membro lê (é o que explica por que a IA
 * renomeou o arquivo dele), só quem governa o tenant altera. Em tenant PF o próprio dono governa.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const canManage = userGovernsTenantScope(auth.user, auth.ctx.storage);

  try {
    if (req.method === 'GET') {
      const policy = await getTenantUploadPolicy(auth.ctx.tenantId);
      return res.status(200).json({ policy, canManage });
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (!canManage) {
        return res.status(403).json({
          message: 'Somente administradores podem alterar a política de upload e IA.',
          code: 'UPLOAD_POLICY_FORBIDDEN',
        });
      }

      const body = (req.body ?? {}) as {
        policy?: Partial<TenantUploadPolicy>;
      } & Partial<TenantUploadPolicy>;
      const patch = (body.policy ?? body) as Partial<TenantUploadPolicy>;

      const policy = await updateTenantUploadPolicy(auth.ctx.tenantId, patch);
      return res.status(200).json({ policy, canManage });
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
