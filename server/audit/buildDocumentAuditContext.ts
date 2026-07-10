import type { AuthUser } from '../auth/types.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import type { DocumentAuditContext } from './documentAuditTypes.js';

export function buildDocumentAuditContext(
  ctx: DocumentRequestContext,
  user: AuthUser,
  requestId?: string,
  options?: { documentOwnerUserId?: string },
): DocumentAuditContext {
  return {
    tenantId: ctx.tenantId,
    tenantType: ctx.tenantType === 'individual' ? 'individual' : 'business',
    collectionPrefix: ctx.storage.collectionPrefix,
    ownerTenantId: ctx.storage.tenantId,
    ownerUserId: options?.documentOwnerUserId ?? ctx.userId,
    actorUserId: user.id,
    actorMembershipId: ctx.membershipId ?? user.membershipId ?? user.memberId,
    actorRoles: user.platformRoles?.map(String),
    actorAccessGroupIds: user.groups,
    actorDisplayName: user.name,
    actorEmail: user.email,
    actorRole: user.role,
    requestId,
  };
}
