import { randomUUID } from 'node:crypto';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import type {
  MongoCompanyMember,
  MongoTenantMember,
  PlatformRole,
  TenantMemberStatus,
} from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import {
  getMemberAccessGroupIds,
  getMemberPlatformRoles,
  mapLegacyRoleFromPlatformRoles,
} from '../auth/memberAuth.js';
import { memberIdFromEmail } from '../utils/slugify.js';
import { normalizeEmail } from '../utils/contactNormalize.js';
import {
  ensureTenantMembersSyncedForOperations,
  invalidateTenantMemberSyncCache,
  syncTenantMembersFromAuth,
} from './tenantMemberSyncService.js';

export function tenantMemberToCompanyMember(member: MongoTenantMember): MongoCompanyMember {
  const tenantRoles = member.tenantRoles?.length ? member.tenantRoles : (['user'] as PlatformRole[]);
  const accessGroupIds = getMemberAccessGroupIds(member as unknown as MongoCompanyMember);
  const authUserId = member.authUserId;

  return {
    _id: member._id,
    tenantId: member.tenantId,
    companyId: member.tenantId,
    userId: authUserId ?? member.memberId,
    authUserId,
    username: member.username,
    name: [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    position: member.requestedAccess?.jobTitle,
    role: mapLegacyRoleFromPlatformRoles(tenantRoles),
    platformRoles: tenantRoles,
    status: member.status as MongoCompanyMember['status'],
    groupIds: accessGroupIds,
    accessGroupIds,
    requestedCompanyId: member.requestedTenantId ?? member.requestedAccess?.tenantId,
    invitedBy: member.invitedBy,
    approvedBy: member.approvedBy,
    approvedAt: member.approvedAt,
    rejectedBy: member.rejectedBy,
    rejectedAt: member.rejectedAt,
    blockedBy: member.blockedBy,
    blockedAt: member.blockedAt,
    accessRequestMessage: member.requestedAccess?.reason ?? member.accessRequestMessage,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export async function getTenantMemberById(memberId: string): Promise<MongoTenantMember | null> {
  const db = await getDb();
  const member = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .findOne({ _id: memberId } as Record<string, unknown>);

  if (member) return member;

  const legacy = await db
    .collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers)
    .findOne({ _id: memberId } as Record<string, unknown>);

  if (!legacy) return null;

  return companyMemberToTenantMember(legacy);
}

function companyMemberToTenantMember(member: MongoCompanyMember): MongoTenantMember {
  const tenantId = member.tenantId ?? member.companyId;
  return {
    _id: member._id,
    memberId: member._id,
    tenantId,
    companyId: tenantId,
    authUserId: member.authUserId ?? member.userId,
    username: member.username,
    email: member.email,
    emailNormalized: normalizeEmail(member.email),
    firstName: member.firstName,
    lastName: member.lastName,
    status: member.status,
    tenantRoles: getMemberPlatformRoles(member),
    accessGroupIds: getMemberAccessGroupIds(member),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export async function findTenantMemberByEmailInTenant(
  tenantId: string,
  email: string,
  statuses?: TenantMemberStatus[],
): Promise<MongoTenantMember | null> {
  const db = await getDb();
  const emailNormalized = normalizeEmail(email);
  const statusFilter = statuses?.length ? { status: { $in: statuses } } : {};

  const member = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    tenantId,
    emailNormalized,
    ...statusFilter,
  } as Record<string, unknown>);

  if (member) return member;

  const legacy = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    companyId: tenantId,
    email: emailNormalized,
    ...statusFilter,
  } as Record<string, unknown>);

  return legacy ? companyMemberToTenantMember(legacy) : null;
}

export async function createUniqueMemberId(email: string, tenantId: string): Promise<string> {
  const db = await getDb();
  let id = memberIdFromEmail(email);
  const existing = await db.collection(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    _id: id,
    tenantId,
  } as Record<string, unknown>);
  if (existing) {
    id = `member_${randomUUID().slice(0, 8)}`;
  }
  return id;
}

export async function saveTenantMember(member: MongoTenantMember): Promise<MongoTenantMember> {
  const db = await getDb();
  const authUserId = member.authUserId;
  const { keycloakUserId: _legacy, ...memberWithoutLegacy } = member as MongoTenantMember & {
    keycloakUserId?: string;
  };
  const doc = {
    ...memberWithoutLegacy,
    authUserId,
    memberId: member.memberId ?? member._id,
    companyId: member.tenantId,
    updatedAt: new Date(),
  };

  await db.collection(REGISTRY_COLLECTIONS.tenantMembers).updateOne(
    { _id: doc._id } as Record<string, unknown>,
    { $set: doc, $unset: { keycloakUserId: '' } },
    { upsert: true },
  );

  const legacy = tenantMemberToCompanyMember(doc);
  await db.collection(REGISTRY_COLLECTIONS.companyMembers).updateOne(
    { _id: doc._id } as Record<string, unknown>,
    { $set: legacy, $unset: { keycloakUserId: '' } },
    { upsert: true },
  );

  return doc;
}

export async function listTenantMembers(tenantId: string) {
  const db = await getDb();
  const members = await db
    .collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers)
    .find({ tenantId } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();

  if (members.length > 0) return members;

  const legacy = await db
    .collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers)
    .find({ companyId: tenantId } as Record<string, unknown>)
    .sort({ name: 1 })
    .toArray();

  return legacy.map(companyMemberToTenantMember);
}

/** Lista membros do tenant após garantir espelhamento auth → Mongo (fonte operacional única). */
export async function listOperationalTenantMembers(
  tenantId: string,
  options?: { forceSync?: boolean },
): Promise<MongoTenantMember[]> {
  if (options?.forceSync) {
    invalidateTenantMemberSyncCache(tenantId);
    await syncTenantMembersFromAuth(tenantId);
  } else {
    await ensureTenantMembersSyncedForOperations(tenantId);
  }
  return listTenantMembers(tenantId);
}

export async function updateTenantMemberFields(
  memberId: string,
  tenantId: string,
  fields: Partial<MongoTenantMember>,
): Promise<MongoTenantMember> {
  const existing = await getTenantMemberById(memberId);
  if (!existing || existing.tenantId !== tenantId) {
    throw new Error('MEMBER_NOT_FOUND');
  }

  const updated: MongoTenantMember = {
    ...existing,
    ...fields,
    _id: existing._id,
    memberId: existing.memberId,
    tenantId: existing.tenantId,
    updatedAt: new Date(),
  };

  return saveTenantMember(updated);
}
