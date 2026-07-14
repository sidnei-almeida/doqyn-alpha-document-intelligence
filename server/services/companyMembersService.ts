import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { CompanyMemberStatus, MongoTenantMember, PlatformRole } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { normalizeEmail } from '../utils/contactNormalize.js';
import {
  createUniqueMemberId,
  getTenantMemberById,
  listTenantMembers,
  saveTenantMember,
  updateTenantMemberFields,
} from './tenantMemberRepository.js';
import { serializeTenantMember } from './memberSerialize.js';

const ALLOWED_ROLES = new Set(['admin', 'manager', 'member', 'auditor']);
const ALLOWED_STATUSES = new Set<CompanyMemberStatus>(['pending', 'active', 'blocked', 'rejected']);

function roleToTenantRoles(role: string): PlatformRole[] {
  if (role === 'admin') return ['company_admin', 'user'];
  return ['user'];
}

/**
 * API legada company-members — persiste apenas em `tenant_members` (formato canônico).
 * Não grava mais em `company_members`.
 */
export async function listCompanyMembers(companyId: string) {
  const members = await listTenantMembers(companyId);
  return members.map(serializeTenantMember);
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
  const emailNormalized = normalizeEmail(email);
  const duplicateEmail = await db.collection(REGISTRY_COLLECTIONS.tenantMembers).findOne({
    tenantId: companyId,
    emailNormalized,
  } as Record<string, unknown>);

  if (duplicateEmail) {
    throw new ServiceError('Já existe um membro com este e-mail.', 'DUPLICATE_EMAIL', 409);
  }

  const id = await createUniqueMemberId(email, companyId);
  const now = new Date();
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] ?? name;
  const lastName = nameParts.slice(1).join(' ') || undefined;

  const member: MongoTenantMember = {
    _id: id,
    memberId: id,
    tenantId: companyId,
    companyId,
    email,
    emailNormalized,
    firstName,
    lastName,
    status,
    tenantRoles: roleToTenantRoles(role),
    accessGroupIds: groupIds,
    accessRequestMessage: input.position?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await saveTenantMember(member);
  return serializeTenantMember(saved);
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
  const existing = await getTenantMemberById(memberId);
  if (!existing || existing.tenantId !== companyId) {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoTenantMember> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ServiceError('Nome não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    const parts = name.split(/\s+/);
    patch.firstName = parts[0] ?? name;
    patch.lastName = parts.slice(1).join(' ') || undefined;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new ServiceError('E-mail inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.email = email;
    patch.emailNormalized = normalizeEmail(email);
  }

  if (input.role !== undefined) {
    if (!ALLOWED_ROLES.has(input.role)) {
      throw new ServiceError('Papel inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.tenantRoles = roleToTenantRoles(input.role);
  }

  if (input.status !== undefined) {
    if (!ALLOWED_STATUSES.has(input.status)) {
      throw new ServiceError('Status inválido.', 'VALIDATION_ERROR', 400);
    }
    patch.status = input.status;
  }

  if (input.position !== undefined) {
    patch.accessRequestMessage = input.position.trim() || undefined;
  }

  try {
    const updated = await updateTenantMemberFields(memberId, companyId, patch);
    return serializeTenantMember(updated);
  } catch {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }
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

  try {
    const updated = await updateTenantMemberFields(memberId, companyId, {
      accessGroupIds: groupIds,
    });
    return serializeTenantMember(updated);
  } catch {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }
}
