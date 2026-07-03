import { REGISTRY_COLLECTIONS, DEV_TENANT_ID } from '../../server/db/constants.js';
import { getDb } from '../../server/db/mongoClient.js';
import type { MongoTenantMember, PlatformRole } from '../../server/db/types.js';
import { normalizeEmail } from '../../server/utils/contactNormalize.js';
import type { DemoSeedManifest } from './manifest.js';

async function upsertActiveTenantMember(input: {
  memberId: string;
  tenantId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantRoles: PlatformRole[];
}): Promise<MongoTenantMember> {
  const db = await getDb();
  const now = new Date();
  const emailNormalized = normalizeEmail(input.email);

  const memberDoc: MongoTenantMember = {
    _id: input.memberId,
    memberId: input.memberId,
    tenantId: input.tenantId,
    companyId: input.tenantId,
    keycloakUserId: input.userId,
    email: input.email,
    emailNormalized,
    firstName: input.firstName,
    lastName: input.lastName,
    status: 'active',
    tenantRoles: input.tenantRoles,
    accessGroupIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const memberFields = { ...memberDoc };
  delete (memberFields as Partial<typeof memberDoc>).createdAt;

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

export async function syncDevTenantMembers(manifest: DemoSeedManifest): Promise<string[]> {
  const admin = manifest.globalAdmin;
  const [firstName, ...lastParts] = admin.displayName.trim().split(/\s+/);
  const lastName = lastParts.join(' ') || 'Admin';

  await upsertActiveTenantMember({
    memberId: admin.membershipId,
    tenantId: admin.tenantId || DEV_TENANT_ID,
    userId: admin.userId,
    email: admin.email,
    firstName,
    lastName,
    tenantRoles: admin.roles as PlatformRole[],
  });

  return [admin.email];
}
