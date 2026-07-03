import type { VercelRequest } from '@vercel/node';
import { usesDoqynAuth } from '../auth/authConfig.js';
import type { AuthUser } from '../auth/types.js';
import { callDoqynAuthAdmin } from '../integrations/doqynAuthAdminClient.js';
import { createUserAuditLog } from './userAuditService.js';
import {
  approveCompanyMember,
  rejectCompanyMember,
} from './userManagementService.js';
import {
  resolveGovernanceMemberIdentity,
} from './governanceMembersService.js';
import { syncMemberDocumentGroups } from './documentGroupsService.js';
import type { NotificationPreferences } from '../db/types.js';
import { maskEmail, sanitizeRejectionReason } from '../utils/maskSensitiveData.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/serviceErrors.js';

type ApproveInput = {
  platformRoles?: string[];
  tenantRoles?: string[];
  accessGroupIds: string[];
  documentGroupIds?: string[];
  notificationPreferences?: Partial<NotificationPreferences>;
};

type AuthMembershipResult = {
  membership: {
    membershipId: string;
    tenantId: string;
    status: string;
    roles?: string[];
    accessGroupIds?: string[];
  };
};

function resolveRoles(input: ApproveInput): string[] {
  return input.platformRoles ?? input.tenantRoles ?? ['user'];
}

async function logApprovedMembershipAudit(
  actor: AuthUser,
  memberId: string,
  input: ApproveInput,
  targetEmail?: string,
) {
  const tenantId = actor.tenantId ?? actor.companyId;
  const rolesAssigned = resolveRoles(input);

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_APPROVED',
    description: 'Solicitação de acesso aprovada.',
    memberId,
    metadata: sanitizeAuditMetadata({
      targetMembershipId: memberId,
      targetEmailMasked: maskEmail(targetEmail),
      rolesAssigned,
      groupsAssigned: input.accessGroupIds,
      documentGroupsAssigned: input.documentGroupIds ?? [],
    }),
  });
}

async function logRejectedMembershipAudit(
  actor: AuthUser,
  memberId: string,
  reason: string,
  targetEmail?: string,
) {
  const tenantId = actor.tenantId ?? actor.companyId;

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_REJECTED',
    description: 'Solicitação de acesso rejeitada.',
    memberId,
    metadata: sanitizeAuditMetadata({
      targetMembershipId: memberId,
      targetEmailMasked: maskEmail(targetEmail),
      reason,
    }),
  });
}

export async function approveMembershipDecision(
  req: VercelRequest,
  actor: AuthUser,
  memberId: string,
  input: ApproveInput,
) {
  const tenantId = actor.tenantId ?? actor.companyId;
  const rolesAssigned = resolveRoles(input);
  const documentGroupIds = input.documentGroupIds ?? [];

  logger.info('membership approve requested', {
    tenantId,
    membershipId: memberId,
    rolesCount: rolesAssigned.length,
    accessGroupIdsCount: input.accessGroupIds.length,
    documentGroupIdsCount: documentGroupIds.length,
  });

  if (!usesDoqynAuth()) {
    const result = await approveCompanyMember(actor, memberId, input);
    if (documentGroupIds.length > 0) {
      const identity = await resolveGovernanceMemberIdentity(req, actor, tenantId, memberId);
      await syncMemberDocumentGroups(tenantId, actor.id, {
        membershipId: memberId,
        userId: identity.userId,
        displayName: identity.displayName,
        email: identity.email,
        documentGroupIds,
      });
    }
    logger.info('membership approve completed (mongo)', {
      tenantId,
      membershipId: memberId,
      documentGroupIdsCount: documentGroupIds.length,
    });
    return result;
  }

  const detail = await callDoqynAuthAdmin<{ member: { user: { email: string } } }>(
    req,
    `/auth/admin/members/${memberId}`,
  );

  const result = await callDoqynAuthAdmin<AuthMembershipResult>(
    req,
    `/auth/admin/members/${memberId}/approve`,
    {
      method: 'POST',
      body: {
        roles: rolesAssigned,
        accessGroupIds: input.accessGroupIds,
        notificationPreferences: input.notificationPreferences,
      },
    },
  );

  let syncedDocumentGroupIds: string[] = [];
  if (documentGroupIds.length > 0) {
    const identity = await resolveGovernanceMemberIdentity(req, actor, tenantId, memberId);
    syncedDocumentGroupIds = await syncMemberDocumentGroups(tenantId, actor.id, {
      membershipId: memberId,
      userId: identity.userId,
      displayName: identity.displayName,
      email: identity.email,
      documentGroupIds,
    });
  }

  await logApprovedMembershipAudit(actor, memberId, input, detail.member.user.email);

  logger.info('membership approve completed (auth)', {
    tenantId,
    membershipId: memberId,
    accessGroupIdsCount: (result.membership.accessGroupIds ?? input.accessGroupIds).length,
    documentGroupIdsCount: syncedDocumentGroupIds.length,
  });

  return {
    member: {
      id: result.membership.membershipId,
      companyId: result.membership.tenantId,
      tenantId: result.membership.tenantId,
      email: detail.member.user.email,
      platformRoles: result.membership.roles ?? rolesAssigned,
      status: result.membership.status,
      accessGroupIds: result.membership.accessGroupIds ?? input.accessGroupIds,
      documentGroupIds: syncedDocumentGroupIds,
      groupIds: syncedDocumentGroupIds,
    },
  };
}

export async function rejectMembershipDecision(
  req: VercelRequest,
  actor: AuthUser,
  memberId: string,
  reason?: string,
) {
  let sanitizedReason: string;
  try {
    sanitizedReason = sanitizeRejectionReason(reason);
  } catch {
    throw new ServiceError('Informe o motivo da rejeição.', 'REJECTION_REASON_REQUIRED', 400);
  }

  if (!usesDoqynAuth()) {
    const result = await rejectCompanyMember(actor, memberId, { reason: sanitizedReason });
    return result;
  }

  const detail = await callDoqynAuthAdmin<{ member: { user: { email: string } } }>(
    req,
    `/auth/admin/members/${memberId}`,
  );

  const result = await callDoqynAuthAdmin<AuthMembershipResult>(
    req,
    `/auth/admin/members/${memberId}/reject`,
    {
      method: 'POST',
      body: { reason: sanitizedReason },
    },
  );

  await logRejectedMembershipAudit(actor, memberId, sanitizedReason, detail.member.user.email);

  return {
    member: {
      id: result.membership.membershipId,
      companyId: result.membership.tenantId,
      tenantId: result.membership.tenantId,
      email: detail.member.user.email,
      platformRoles: result.membership.roles ?? [],
      status: result.membership.status,
      accessGroupIds: result.membership.accessGroupIds ?? [],
      groupIds: result.membership.accessGroupIds ?? [],
    },
  };
}
