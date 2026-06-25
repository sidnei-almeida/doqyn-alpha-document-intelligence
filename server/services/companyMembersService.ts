import { randomUUID } from 'node:crypto';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { CompanyMemberStatus, MongoCompanyMember } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { memberIdFromEmail } from '../utils/slugify.js';

import { serializeCompanyMember } from './memberSerialize.js';

const ALLOWED_ROLES = new Set(['admin', 'manager', 'member', 'auditor']);
const ALLOWED_STATUSES = new Set<CompanyMemberStatus>(['pending', 'active', 'blocked', 'rejected']);

function serializeMember(member: MongoCompanyMember) {
  return serializeCompanyMember(member);
}

export async function listCompanyMembers(companyId: string) {
  const db = await getDb();
  const members = await db
    .collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers)
    .find({ companyId })
    .sort({ name: 1 })
    .toArray();

  return members.map(serializeMember);
}

export async function createCompanyMember(
  companyId: string,
  input: {
    name: string;
    email: string;
    role?: string;
    status?: CompanyMemberStatus;
    groupIds?: string[];
    position?: string;
  },
) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!name) {
    throw new ServiceError('Nome do membro é obrigatório.', 'VALIDATION_ERROR', 400);
  }
  if (!email || !email.includes('@')) {
    throw new ServiceError('E-mail inválido.', 'VALIDATION_ERROR', 400);
  }

  const role = input.role ?? 'member';
  if (!ALLOWED_ROLES.has(role)) {
    throw new ServiceError('Papel inválido.', 'VALIDATION_ERROR', 400);
  }

  const status = input.status ?? 'pending';
  if (!ALLOWED_STATUSES.has(status)) {
    throw new ServiceError('Status inválido. Use pending, active ou blocked.', 'VALIDATION_ERROR', 400);
  }

  const groupIds = input.groupIds ?? [];
  await assertGroupIdsExist(companyId, groupIds, { requireActive: false });

  const db = await getDb();
  const duplicateEmail = await db.collection(REGISTRY_COLLECTIONS.companyMembers).findOne({
    companyId,
    email,
  } as Record<string, unknown>);

  if (duplicateEmail) {
    throw new ServiceError('Já existe um membro com este e-mail.', 'DUPLICATE_EMAIL', 409);
  }

  let id = memberIdFromEmail(email);
  const existingId = await db.collection(REGISTRY_COLLECTIONS.companyMembers).findOne({
    _id: id,
    companyId,
  } as Record<string, unknown>);

  if (existingId) {
    id = `member_${randomUUID().slice(0, 8)}`;
  }

  const now = new Date();
  const member: MongoCompanyMember = {
    _id: id,
    tenantId: companyId,
    companyId,
    userId: id,
    name,
    email,
    position: input.position?.trim() || undefined,
    role: role as MongoCompanyMember['role'],
    status,
    groupIds,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(REGISTRY_COLLECTIONS.companyMembers).insertOne(member as Record<string, unknown>);

  return serializeMember(member);
}

export async function updateCompanyMember(
  companyId: string,
  memberId: string,
  input: {
    name?: string;
    email?: string;
    role?: string;
    status?: CompanyMemberStatus;
    position?: string;
  },
) {
  const db = await getDb();
  const existing = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    _id: memberId,
    companyId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoCompanyMember> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ServiceError('Nome não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    patch.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new ServiceError('E-mail inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.email = email;
  }

  if (input.role !== undefined) {
    if (!ALLOWED_ROLES.has(input.role)) {
      throw new ServiceError('Papel inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.role = input.role as MongoCompanyMember['role'];
  }

  if (input.status !== undefined) {
    if (!ALLOWED_STATUSES.has(input.status)) {
      throw new ServiceError('Status inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.status = input.status;
  }

  if (input.position !== undefined) {
    patch.position = input.position.trim() || undefined;
  }

  await db.collection(REGISTRY_COLLECTIONS.companyMembers).updateOne(
    { _id: memberId, companyId } as Record<string, unknown>,
    { $set: patch },
  );

  const updated = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    _id: memberId,
    companyId,
  } as Record<string, unknown>);

  return serializeMember(updated!);
}

export async function updateMemberStatus(
  companyId: string,
  memberId: string,
  status: CompanyMemberStatus,
) {
  if (!ALLOWED_STATUSES.has(status)) {
    throw new ServiceError('Status inválido. Use pending, active ou blocked.', 'VALIDATION_ERROR', 400);
  }

  return updateCompanyMember(companyId, memberId, { status });
}

export async function updateMemberGroups(
  companyId: string,
  memberId: string,
  groupIds: string[],
) {
  await assertGroupIdsExist(companyId, groupIds, { requireActive: false });

  const db = await getDb();
  const existing = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    _id: memberId,
    companyId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }

  await db.collection(REGISTRY_COLLECTIONS.companyMembers).updateOne(
    { _id: memberId, companyId } as Record<string, unknown>,
    { $set: { groupIds, updatedAt: new Date() } },
  );

  const updated = await db.collection<MongoCompanyMember>(REGISTRY_COLLECTIONS.companyMembers).findOne({
    _id: memberId,
    companyId,
  } as Record<string, unknown>);

  return serializeMember(updated!);
}
