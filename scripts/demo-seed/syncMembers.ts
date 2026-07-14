import { REGISTRY_COLLECTIONS, DEV_TENANT_ID } from '../../server/db/constants.js';
import { getDb } from '../../server/db/mongoClient.js';
import type { MongoTenantMember, PlatformRole } from '../../server/db/types.js';
import { normalizeEmail } from '../../server/utils/contactNormalize.js';
import type { DemoSeedManifest, DemoSeedManifestGlobalAdmin } from './manifest.js';

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const [firstName, ...lastParts] = displayName.trim().split(/\s+/);
  return {
    firstName: firstName || 'Usuário',
    lastName: lastParts.join(' ') || 'Demo',
  };
}

async function upsertActiveTenantMember(input: {
  memberId: string;
  tenantId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantRoles: PlatformRole[];
  jobTitle?: string;
  departmentText?: string;
}): Promise<MongoTenantMember> {
  const db = await getDb();
  const now = new Date();
  const emailNormalized = normalizeEmail(input.email);

  const memberDoc: MongoTenantMember = {
    _id: input.memberId,
    memberId: input.memberId,
    tenantId: input.tenantId,
    companyId: input.tenantId,
    authUserId: input.userId,
    email: input.email,
    emailNormalized,
    firstName: input.firstName,
    lastName: input.lastName,
    status: 'active',
    tenantRoles: input.tenantRoles,
    accessGroupIds: [],
    ...(input.jobTitle || input.departmentText
      ? {
          requestedAccess: {
            jobTitle: input.jobTitle,
            departmentText: input.departmentText,
            requestedAt: now,
            source: 'access_request' as const,
          },
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  const memberFields = { ...memberDoc };
  delete (memberFields as Partial<typeof memberDoc>).createdAt;

  const emailFilter = {
    tenantId: input.tenantId,
    emailNormalized,
  } as Record<string, unknown>;

  const existing = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne(emailFilter);

  if (existing && existing._id !== input.memberId) {
    await db
      .collection(REGISTRY_COLLECTIONS.tenantMembers)
      .deleteOne({ _id: existing._id } as Record<string, unknown>);
  }

  await db.collection(REGISTRY_COLLECTIONS.tenantMembers).updateOne(
    { _id: input.memberId } as Record<string, unknown>,
    {
      $setOnInsert: { createdAt: now },
      $set: memberFields,
    },
    { upsert: true },
  );

  const saved = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne({ _id: input.memberId } as Record<string, unknown>);

  if (!saved) {
    throw new Error(`Falha ao sincronizar tenant_member ${input.email}.`);
  }

  return saved;
}

async function syncManifestMember(
  member: DemoSeedManifestGlobalAdmin,
  tenantId: string,
): Promise<string> {
  const { firstName, lastName } = splitDisplayName(member.displayName);

  await upsertActiveTenantMember({
    memberId: member.membershipId,
    tenantId,
    userId: member.userId,
    email: member.email,
    firstName,
    lastName,
    tenantRoles: member.roles as PlatformRole[],
    jobTitle: member.jobTitle,
    departmentText: member.departmentText,
  });

  return member.email;
}

export async function syncDevTenantMembers(manifest: DemoSeedManifest): Promise<string[]> {
  const tenantId = manifest.globalAdmin.tenantId || DEV_TENANT_ID;
  const syncedEmails: string[] = [];

  syncedEmails.push(await syncManifestMember(manifest.globalAdmin, tenantId));

  for (const member of manifest.companyDevActiveUsers) {
    syncedEmails.push(await syncManifestMember(member, tenantId));
  }

  return syncedEmails;
}
