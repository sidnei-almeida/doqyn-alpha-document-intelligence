import { randomUUID } from 'node:crypto';
import type { UserAuditAction, MongoAuditLog } from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { withTenantFieldsFromContext } from '../tenancy/tenantQuery.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';

export async function createUserAuditLog(input: {
  companyId?: string;
  tenantId?: string;
  ownerUserId?: string;
  actor: AuthUser | { userId: string; name: string; role?: string };
  action: UserAuditAction;
  description: string;
  metadata?: Record<string, unknown>;
  memberId?: string;
}): Promise<void> {
  const tenantId = input.tenantId ?? input.companyId;
  if (!tenantId) {
    throw new Error('tenantId é obrigatório para auditoria.');
  }

  const actorUserId = 'id' in input.actor ? input.actor.id : input.actor.userId;
  const ownerUserId = input.ownerUserId ?? actorUserId;

  const { auditLogs, storage } = await getTenantCollections(tenantId, {
    userId: ownerUserId,
  });

  const actorName = input.actor.name;
  const actorRole =
    'role' in input.actor && input.actor.role
      ? input.actor.role
      : 'platformRoles' in input.actor && input.actor.platformRoles?.[0]
        ? input.actor.platformRoles[0]
        : 'system';

  await auditLogs.insertOne(
    withTenantFieldsFromContext(
      storage,
      {
        _id: `audit_${randomUUID()}`,
        documentId: null,
        versionId: null,
        actor: {
          userId: actorUserId,
          name: actorName,
          role: actorRole,
        },
        action: input.action,
        description: input.description,
        metadata: sanitizeAuditMetadata({
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.metadata ?? {}),
        }),
        createdAt: new Date(),
      },
      ownerUserId,
    ) as MongoAuditLog,
  );
}
