import { DEV_TENANT_ID, REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { MongoCompanyMember, MongoTenantMember } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import type { VerifiedKeycloakAuth } from '../auth/keycloakJwtVerifier.js';
import { getMemberAccessGroupIds, getMemberPlatformRoles } from '../auth/memberAuth.js';
import { ServiceError } from '../utils/serviceErrors.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapLegacyMemberToTenantMember(member: MongoCompanyMember): MongoTenantMember {
  const tenantId = member.tenantId ?? member.companyId;
  return {
    _id: member._id,
    memberId: member._id,
    tenantId,
    companyId: tenantId,
    keycloakUserId: member.keycloakUserId,
    username: member.username,
    email: member.email,
    emailNormalized: normalizeEmail(member.email),
    firstName: member.firstName,
    lastName: member.lastName,
    status: member.status,
    tenantRoles: getMemberPlatformRoles(member),
    accessGroupIds: getMemberAccessGroupIds(member),
    requestedTenantId: member.requestedCompanyId,
    invitedBy: member.invitedBy,
    approvedBy: member.approvedBy,
    approvedAt: member.approvedAt,
    rejectedBy: member.rejectedBy,
    rejectedAt: member.rejectedAt,
    blockedBy: member.blockedBy,
    blockedAt: member.blockedAt,
    accessRequestMessage: member.accessRequestMessage,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export async function findActiveTenantMember(input: {
  keycloakUserId?: string;
  email?: string;
}): Promise<MongoTenantMember | null> {
  const db = await getDb();
  const emailNormalized = input.email ? normalizeEmail(input.email) : undefined;

  let member = input.keycloakUserId
    ? await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
        keycloakUserId: input.keycloakUserId,
        status: 'active',
      } as Record<string, unknown>)
    : null;

  if (!member && emailNormalized) {
    member = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
      emailNormalized,
      status: 'active',
    } as Record<string, unknown>);
  }

  if (member) return member;

  let legacy = input.keycloakUserId
    ? await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
        keycloakUserId: input.keycloakUserId,
        status: 'active',
      } as Record<string, unknown>)
    : null;

  if (!legacy && emailNormalized) {
    legacy = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
      email: emailNormalized,
      status: 'active',
    } as Record<string, unknown>);
  }

  return legacy ? mapLegacyMemberToTenantMember(legacy) : null;
}

/** Busca membership por identidade, qualquer status (exceto rejected). Usado em GET /api/me. */
export async function findTenantMemberByIdentity(input: {
  keycloakUserId?: string;
  email?: string;
}): Promise<MongoTenantMember | null> {
  const db = await getDb();
  const emailNormalized = input.email ? normalizeEmail(input.email) : undefined;

  const statusFilter = { status: { $in: ['active', 'pending', 'blocked'] } };

  let member = input.keycloakUserId
    ? await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
        keycloakUserId: input.keycloakUserId,
        ...statusFilter,
      } as Record<string, unknown>)
    : null;

  if (!member && emailNormalized) {
    member = await db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers).findOne({
      emailNormalized,
      ...statusFilter,
    } as Record<string, unknown>);
  }

  if (member) return member;

  let legacy = input.keycloakUserId
    ? await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
        keycloakUserId: input.keycloakUserId,
        ...statusFilter,
      } as Record<string, unknown>)
    : null;

  if (!legacy && emailNormalized) {
    legacy = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
      email: emailNormalized,
      ...statusFilter,
    } as Record<string, unknown>);
  }

  return legacy ? mapLegacyMemberToTenantMember(legacy) : null;
}

export async function requireActiveTenantMember(
  claims: VerifiedKeycloakAuth,
): Promise<MongoTenantMember> {
  const member = await findActiveTenantMember({
    keycloakUserId: claims.keycloakUserId,
    email: claims.email,
  });

  if (!member) {
    throw new ServiceError(
      'Seu usuário ainda não está vinculado a um cliente ativo no DOQYN.',
      'MEMBER_NOT_LINKED',
      403,
    );
  }

  return member;
}

export function getTenantRoles(member: MongoTenantMember) {
  return member.tenantRoles?.length ? member.tenantRoles : (['user'] as const);
}

export function getMemberAccessGroups(member: MongoTenantMember): string[] {
  return member.accessGroupIds ?? [];
}

/** Usuário Keycloak validado no checkpoint de integração (desenvolvimento). */
export const SIDNEI_DEV_KEYCLOAK_USER_ID = '2806775c-c73d-4882-8a55-4f39d14a25ae';
const SIDNEI_DEV_EMAIL = 'sidnei.almeida1806@gmail.com';
const SIDNEI_DEV_MEMBER_ID = 'member_sidnei';

/**
 * Garante vínculo ativo do usuário sidnei ao tenant company_dev.
 * Upsert idempotente por keycloakUserId ou emailNormalized.
 */
export async function ensureSidneiDevTenantMember(): Promise<MongoTenantMember> {
  const db = await getDb();
  const now = new Date();
  const emailNormalized = normalizeEmail(SIDNEI_DEV_EMAIL);
  const tenantId = DEV_TENANT_ID;

  const members = db.collection<MongoTenantMember>(REGISTRY_COLLECTIONS.tenantMembers);

  const existing =
    (await members.findOne({ keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID } as Record<string, unknown>)) ??
    (await members.findOne({ emailNormalized, tenantId } as Record<string, unknown>));

  const memberId = existing?._id ?? SIDNEI_DEV_MEMBER_ID;

  const memberDoc: MongoTenantMember = {
    _id: memberId,
    memberId,
    tenantId,
    companyId: tenantId,
    keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID,
    username: 'sidnei',
    email: SIDNEI_DEV_EMAIL,
    emailNormalized,
    firstName: 'Sidnei',
    lastName: 'Almeida',
    status: 'active',
    tenantRoles: ['company_admin', 'user'],
    accessGroupIds: [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await members.updateOne(
    { _id: memberId } as Record<string, unknown>,
    { $set: memberDoc },
    { upsert: true },
  );

  // Compatibilidade legado: company_members ainda é fallback de leitura em alguns fluxos.
  await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).updateOne(
    {
      $or: [
        { keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID },
        { email: emailNormalized, companyId: tenantId },
      ],
    } as Record<string, unknown>,
    {
      $setOnInsert: { _id: memberId, createdAt: now },
      $set: {
        tenantId,
        companyId: tenantId,
        userId: SIDNEI_DEV_KEYCLOAK_USER_ID,
        keycloakUserId: SIDNEI_DEV_KEYCLOAK_USER_ID,
        username: 'sidnei',
        name: 'Sidnei Almeida',
        email: SIDNEI_DEV_EMAIL,
        firstName: 'Sidnei',
        lastName: 'Almeida',
        role: 'member',
        platformRoles: ['company_admin', 'user'],
        status: 'active',
        groupIds: [],
        accessGroupIds: [],
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const saved = await members.findOne({ _id: memberId } as Record<string, unknown>);
  if (!saved) {
    throw new ServiceError('Falha ao garantir tenant_member do sidnei.', 'MEMBER_SEED_FAILED', 500);
  }
  return saved;
}
