import type { AuthUser } from '../auth/types.js';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import type { MongoCompanyMember, MongoTenantMember } from '../db/types.js';

export function resolveAuthUserDisplayName(user: Pick<AuthUser, 'firstName' | 'lastName' | 'name' | 'email'>): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.name?.trim() || user.email;
}

function resolveMemberDisplayName(
  member: Pick<MongoTenantMember, 'firstName' | 'lastName' | 'email'> & { name?: string },
): string {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return member.name?.trim() || member.email;
}

export async function resolveDocumentOwnerName(input: {
  tenantId: string;
  ownerUserId: string;
  displayNameHint?: string;
  actor?: AuthUser;
}): Promise<string> {
  const hint = input.displayNameHint?.trim();
  if (hint) return hint;

  if (input.actor?.id === input.ownerUserId) {
    return resolveAuthUserDisplayName(input.actor);
  }

  const db = await getDb();
  const memberFilter = {
    tenantId: input.tenantId,
    $or: [
      { keycloakUserId: input.ownerUserId },
      { memberId: input.ownerUserId },
      { _id: input.ownerUserId },
    ],
  } as Record<string, unknown>;

  const tenantMember = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne(memberFilter);

  if (tenantMember) {
    return resolveMemberDisplayName(tenantMember);
  }

  const legacyMember = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    companyId: input.tenantId,
    $or: [
      { keycloakUserId: input.ownerUserId },
      { userId: input.ownerUserId },
      { _id: input.ownerUserId },
    ],
  } as Record<string, unknown>);

  if (legacyMember) {
    return resolveMemberDisplayName(legacyMember as unknown as MongoTenantMember & { name?: string });
  }

  return input.ownerUserId;
}

export async function loadTenantMemberDisplayNames(
  tenantId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, string>();
  if (!uniqueIds.length) return result;

  const db = await getDb();
  const tenantMembers = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .find({
      tenantId,
      $or: [
        { keycloakUserId: { $in: uniqueIds } },
        { memberId: { $in: uniqueIds } },
        { _id: { $in: uniqueIds } },
      ],
    } as Record<string, unknown>)
    .toArray();

  for (const member of tenantMembers) {
    const displayName = resolveMemberDisplayName(member);
    if (member.keycloakUserId) result.set(member.keycloakUserId, displayName);
    if (member.memberId) result.set(member.memberId, displayName);
    result.set(String(member._id), displayName);
  }

  const legacyMembers = await db
    .collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers)
    .find({
      companyId: tenantId,
      $or: [
        { keycloakUserId: { $in: uniqueIds } },
        { userId: { $in: uniqueIds } },
        { _id: { $in: uniqueIds } },
      ],
    } as Record<string, unknown>)
    .toArray();

  for (const member of legacyMembers) {
    const displayName = resolveMemberDisplayName(
      member as unknown as MongoTenantMember & { name?: string },
    );
    if (member.keycloakUserId) result.set(member.keycloakUserId, displayName);
    if (member.userId) result.set(member.userId, displayName);
    result.set(String(member._id), displayName);
  }

  return result;
}
