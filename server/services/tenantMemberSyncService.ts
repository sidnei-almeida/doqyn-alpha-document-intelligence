import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import type {
  MongoTenantMember,
  PlatformRole,
  TenantMemberStatus,
} from '../db/types.js';
import { usesDoqynAuth } from '../auth/authConfig.js';
import { fetchAuthTenantMembersForSync } from '../integrations/doqynAuthInternalClient.js';
import type { AuthTenantMemberSyncSnapshot } from '../integrations/authTenantMemberTypes.js';
import { normalizeEmail } from '../utils/contactNormalize.js';
import { logger } from '../utils/logger.js';

export type { AuthTenantMemberSyncSnapshot } from '../integrations/authTenantMemberTypes.js';

const SYNC_TTL_MS = 15_000;
const lastSyncedAtByTenant = new Map<string, number>();

function mapAuthStatus(status: string): TenantMemberStatus {
  if (status === 'removed') return 'rejected';
  if (status === 'active' || status === 'pending' || status === 'blocked' || status === 'rejected') {
    return status;
  }
  return 'rejected';
}

function mapPlatformRoles(roles: string[]): PlatformRole[] {
  const allowed: PlatformRole[] = ['doqyn_admin', 'company_admin', 'individual_admin', 'user'];
  const mapped = roles.filter((role): role is PlatformRole =>
    allowed.includes(role as PlatformRole),
  );
  return mapped.length > 0 ? mapped : ['user'];
}

export function invalidateTenantMemberSyncCache(tenantId: string): void {
  lastSyncedAtByTenant.delete(tenantId);
}

export async function upsertTenantMemberFromAuthSnapshot(
  snapshot: AuthTenantMemberSyncSnapshot,
): Promise<MongoTenantMember> {
  if (!isMongoNativeConfigured()) {
    throw new Error('MongoDB não configurado para sincronizar tenant_members.');
  }

  const db = await getDb();
  const now = new Date();
  const email = snapshot.email.trim().toLowerCase();
  const emailNormalized = normalizeEmail(email);
  const firstName = snapshot.firstName?.trim() || undefined;
  const lastName = snapshot.lastName?.trim() || undefined;
  const tenantRoles = mapPlatformRoles(snapshot.tenantRoles);
  const status = mapAuthStatus(snapshot.status);
  const approvedAt = snapshot.approvedAt ? new Date(snapshot.approvedAt) : undefined;
  const createdAt = snapshot.createdAt ? new Date(snapshot.createdAt) : now;
  const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : now;

  const memberDoc: MongoTenantMember = {
    _id: snapshot.membershipId,
    memberId: snapshot.membershipId,
    tenantId: snapshot.tenantId,
    companyId: snapshot.tenantId,
    keycloakUserId: snapshot.userId,
    username: email,
    email,
    emailNormalized,
    firstName,
    lastName,
    whatsapp: snapshot.whatsapp?.trim() || undefined,
    status,
    tenantRoles,
    accessGroupIds: snapshot.accessGroupIds ?? [],
    ...(snapshot.jobTitle || snapshot.departmentText || snapshot.source
      ? {
          requestedAccess: {
            jobTitle: snapshot.jobTitle?.trim() || undefined,
            departmentText: snapshot.departmentText?.trim() || undefined,
            requestedAt: approvedAt ?? createdAt,
            source: snapshot.source ?? 'admin_invite',
          },
        }
      : {}),
    invitedBy: snapshot.invitedBy ?? undefined,
    approvedAt,
    createdAt,
    updatedAt,
  };

  const memberFields = { ...memberDoc };
  delete (memberFields as Partial<typeof memberDoc>).createdAt;

  const existingByEmail = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    tenantId: snapshot.tenantId,
    emailNormalized,
  } as Record<string, unknown>);

  if (existingByEmail && existingByEmail._id !== snapshot.membershipId) {
    await db
      .collection(REGISTRY_COLLECTIONS.tenantMembers)
      .deleteOne({ _id: existingByEmail._id } as Record<string, unknown>);
  }

  await db.collection(REGISTRY_COLLECTIONS.tenantMembers).updateOne(
    { _id: snapshot.membershipId } as Record<string, unknown>,
    {
      $setOnInsert: { createdAt },
      $set: memberFields,
    },
    { upsert: true },
  );

  const saved = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne({ _id: snapshot.membershipId } as Record<string, unknown>);

  if (!saved) {
    throw new Error(`Falha ao sincronizar tenant_member ${snapshot.email}.`);
  }

  return saved;
}

export async function syncTenantMembersFromAuth(tenantId: string): Promise<number> {
  if (!usesDoqynAuth() || !isMongoNativeConfigured()) {
    return 0;
  }

  const snapshots = await fetchAuthTenantMembersForSync(tenantId);
  let synced = 0;

  for (const snapshot of snapshots) {
    await upsertTenantMemberFromAuthSnapshot(snapshot);
    synced += 1;
  }

  lastSyncedAtByTenant.set(tenantId, Date.now());

  logger.info('tenant members synced from auth', {
    tenantId,
    syncedCount: synced,
  });

  return synced;
}

export async function ensureTenantMembersSyncedForOperations(
  tenantId: string,
  options?: { force?: boolean },
): Promise<void> {
  if (!usesDoqynAuth() || !isMongoNativeConfigured()) {
    return;
  }

  if (options?.force) {
    invalidateTenantMemberSyncCache(tenantId);
  }

  const lastSyncedAt = lastSyncedAtByTenant.get(tenantId) ?? 0;
  if (!options?.force && Date.now() - lastSyncedAt < SYNC_TTL_MS) {
    return;
  }

  try {
    await syncTenantMembersFromAuth(tenantId);
  } catch (error) {
    logger.warn('tenant member sync failed', {
      tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
