import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertAppInternalApiKey } from '../../../server/auth/requireAppInternalApiKey.js';
import { isMongoNativeConfigured } from '../../../server/db/mongoClient.js';
import type { TenantMemberStatus } from '../../../server/db/types.js';
import {
  invalidateTenantMemberSyncCache,
  upsertTenantMemberFromAuthSnapshot,
} from '../../../server/services/tenantMemberSyncService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { logger } from '../../../server/utils/logger.js';

type SyncBody = {
  membershipId?: string;
  tenantId?: string;
  userId?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  whatsapp?: string | null;
  status?: TenantMemberStatus;
  tenantRoles?: string[];
  accessGroupIds?: string[];
  invitedBy?: string | null;
  approvedAt?: string | null;
  jobTitle?: string | null;
  departmentText?: string | null;
  source?: 'admin_invite' | 'access_request' | 'migration' | 'manual_seed';
  createdAt?: string;
  updatedAt?: string;
};

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

    const body = (req.body ?? {}) as SyncBody;
    const membershipId = body.membershipId?.trim();
    const tenantId = body.tenantId?.trim();
    const userId = body.userId?.trim();
    const email = body.email?.trim();

    if (!membershipId || !tenantId || !userId || !email) {
      return res.status(400).json({
        ok: false,
        message: 'membershipId, tenantId, userId e email são obrigatórios.',
        code: 'VALIDATION_ERROR',
      });
    }

    const member = await upsertTenantMemberFromAuthSnapshot({
      membershipId,
      tenantId,
      userId,
      email,
      firstName: body.firstName,
      lastName: body.lastName,
      whatsapp: body.whatsapp,
      status: body.status ?? 'active',
      tenantRoles: body.tenantRoles ?? ['user'],
      accessGroupIds: body.accessGroupIds ?? [],
      invitedBy: body.invitedBy,
      approvedAt: body.approvedAt,
      jobTitle: body.jobTitle,
      departmentText: body.departmentText,
      source: body.source ?? 'admin_invite',
      createdAt: body.createdAt,
      updatedAt: body.updatedAt,
    });

    invalidateTenantMemberSyncCache(tenantId);

    return res.status(200).json({
      ok: true,
      memberId: member._id,
      tenantId: member.tenantId,
      userId: member.keycloakUserId ?? member.memberId,
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
        code: error.code,
      });
    }

    logger.error('tenant member sync unexpected error', {
      message: error instanceof Error ? error.message : 'unknown',
    });

    return res.status(500).json({
      ok: false,
      message: 'Falha ao sincronizar membro do tenant.',
      code: 'TENANT_MEMBER_SYNC_FAILED',
    });
  }
}
