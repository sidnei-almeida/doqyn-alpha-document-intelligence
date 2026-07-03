import { randomUUID } from 'node:crypto';
import type { MongoDocumentGroup, MongoDocumentGroupMember } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { slugifyName } from '../utils/slugify.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { withClassRuleFieldsFromContext } from '../tenancy/tenantQuery.js';

type ServiceOpts = { ownerUserId?: string };

async function resolveContext(tenantId: string, opts?: ServiceOpts) {
  const collections = await requireTenantGovernanceCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  const scope = buildClassRuleOwnershipFilter(collections.storage);
  return { collections, scope, storage: collections.storage };
}

export function serializeDocumentGroup(group: MongoDocumentGroup, memberCount = 0, linkedCategoryCount = 0) {
  return {
    id: group._id,
    tenantId: group.tenantId ?? group.companyId,
    companyId: group.companyId,
    name: group.name,
    slug: group.slug,
    description: group.description,
    active: group.active,
    memberCount,
    linkedCategoryCount,
    createdByUserId: group.createdBy,
    createdBy: group.createdBy,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export function serializeGroupMember(member: MongoDocumentGroupMember) {
  return {
    id: member._id,
    groupId: member.groupId,
    membershipId: member.membershipId,
    userId: member.userId,
    displayName: member.displayName,
    email: member.email,
    active: member.active,
    addedByUserId: member.addedBy,
    addedAt: member.addedAt.toISOString(),
  };
}

export async function listDocumentGroups(tenantId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const groups = await collections.documentGroups
    .find(scope)
    .sort({ name: 1 })
    .toArray();

  const members = await collections.documentGroupMembers
    .find({ ...scope, active: true })
    .toArray();

  const rules = await collections.documentRules
    .find({ ...scope, active: true })
    .toArray();

  const memberCounts = new Map<string, number>();
  for (const member of members as MongoDocumentGroupMember[]) {
    memberCounts.set(member.groupId, (memberCounts.get(member.groupId) ?? 0) + 1);
  }

  const categoryCounts = new Map<string, Set<string>>();
  for (const rule of rules) {
    if (!categoryCounts.has(rule.groupId)) {
      categoryCounts.set(rule.groupId, new Set());
    }
    categoryCounts.get(rule.groupId)!.add(rule.categoryId);
  }

  return (groups as MongoDocumentGroup[]).map((group) =>
    serializeDocumentGroup(
      group,
      memberCounts.get(group._id) ?? 0,
      categoryCounts.get(group._id)?.size ?? 0,
    ),
  );
}

export async function createDocumentGroup(
  tenantId: string,
  userId: string,
  input: { name: string; description?: string; slug?: string },
) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceError('Nome do grupo é obrigatório.', 'VALIDATION_ERROR', 400);
  }

  const slug = input.slug?.trim() ? slugifyName(input.slug) : slugifyName(name);
  if (!slug) {
    throw new ServiceError('Slug inválido.', 'VALIDATION_ERROR', 400);
  }

  const { collections, scope, storage } = await resolveContext(tenantId, { ownerUserId: userId });

  const duplicate = await collections.documentGroups.findOne({
    ...scope,
    slug,
  } as Record<string, unknown>);

  if (duplicate) {
    throw new ServiceError('Já existe um grupo com este slug.', 'DUPLICATE_SLUG', 409);
  }

  let id = `group_${slug.replace(/-/g, '_')}`;
  const existingId = await collections.documentGroups.findOne({
    ...scope,
    _id: id,
  } as Record<string, unknown>);

  if (existingId) {
    id = `group_${randomUUID().slice(0, 8)}`;
  }

  const now = new Date();
  const group = withClassRuleFieldsFromContext(
    storage,
    {
      _id: id,
      name,
      slug,
      description: input.description?.trim() || '',
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
  ) as MongoDocumentGroup;

  await collections.documentGroups.insertOne(group as Record<string, unknown>);

  return serializeDocumentGroup(group);
}

export async function updateDocumentGroup(
  tenantId: string,
  groupId: string,
  input: { name?: string; description?: string; active?: boolean },
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const existing = await collections.documentGroups.findOne({
    ...scope,
    _id: groupId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Grupo documental não encontrado.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoDocumentGroup> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ServiceError('Nome não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.active !== undefined) patch.active = input.active;

  await collections.documentGroups.updateOne(
    { ...scope, _id: groupId } as Record<string, unknown>,
    { $set: patch },
  );

  const updated = await collections.documentGroups.findOne({
    ...scope,
    _id: groupId,
  } as Record<string, unknown>);

  return serializeDocumentGroup(updated as MongoDocumentGroup);
}

export async function assertDocumentGroupExists(
  tenantId: string,
  groupId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const group = await collections.documentGroups.findOne({
    ...scope,
    _id: groupId,
    active: true,
  } as Record<string, unknown>);

  if (!group) {
    throw new ServiceError('Grupo documental não encontrado ou inativo.', 'GROUP_NOT_FOUND', 404);
  }

  return group as MongoDocumentGroup;
}

export async function listGroupMembers(
  tenantId: string,
  groupId: string,
  opts?: ServiceOpts,
) {
  await assertDocumentGroupExists(tenantId, groupId, opts);
  const { collections, scope } = await resolveContext(tenantId, opts);

  const members = await collections.documentGroupMembers
    .find({ ...scope, groupId, active: true })
    .sort({ addedAt: -1 })
    .toArray();

  return (members as MongoDocumentGroupMember[]).map(serializeGroupMember);
}

export async function addGroupMember(
  tenantId: string,
  groupId: string,
  userId: string,
  input: {
    membershipId: string;
    userId: string;
    displayName?: string;
    email?: string;
  },
) {
  await assertDocumentGroupExists(tenantId, groupId, { ownerUserId: userId });
  const { collections, scope, storage } = await resolveContext(tenantId, { ownerUserId: userId });

  const existing = await collections.documentGroupMembers.findOne({
    ...scope,
    groupId,
    membershipId: input.membershipId,
    active: true,
  } as Record<string, unknown>);

  if (existing) {
    throw new ServiceError('Membro já pertence a este grupo.', 'DUPLICATE_MEMBER', 409);
  }

  const now = new Date();
  const member = withClassRuleFieldsFromContext(
    storage,
    {
      _id: `dgm_${randomUUID().slice(0, 12)}`,
      groupId,
      membershipId: input.membershipId,
      userId: input.userId,
      displayName: input.displayName?.trim(),
      email: input.email?.trim(),
      active: true,
      addedBy: userId,
      addedAt: now,
    },
    userId,
  ) as MongoDocumentGroupMember;

  await collections.documentGroupMembers.insertOne(member as Record<string, unknown>);
  return serializeGroupMember(member);
}

export async function removeGroupMember(
  tenantId: string,
  groupId: string,
  membershipId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);

  const result = await collections.documentGroupMembers.updateOne(
    { ...scope, groupId, membershipId, active: true } as Record<string, unknown>,
    { $set: { active: false } },
  );

  if (result.matchedCount === 0) {
    throw new ServiceError('Associação membro-grupo não encontrada.', 'NOT_FOUND', 404);
  }

  return { groupId, membershipId, removed: true };
}

export async function listMembershipGroupIds(
  tenantId: string,
  membershipId: string,
  opts?: ServiceOpts,
): Promise<string[]> {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const members = await collections.documentGroupMembers
    .find({ ...scope, membershipId, active: true })
    .project({ groupId: 1 })
    .toArray();

  return members.map((m) => m.groupId);
}

export async function listAllGroupMemberships(tenantId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const members = await collections.documentGroupMembers
    .find({ ...scope, active: true })
    .toArray();

  return (members as MongoDocumentGroupMember[]).map(serializeGroupMember);
}

export async function syncMemberDocumentGroups(
  tenantId: string,
  actorUserId: string,
  input: {
    membershipId: string;
    userId: string;
    displayName?: string;
    email?: string;
    documentGroupIds: string[];
  },
  opts?: ServiceOpts,
): Promise<string[]> {
  const desired = [...new Set(input.documentGroupIds)];
  await assertGroupIdsExist(tenantId, desired, {
    requireActive: true,
    ownerUserId: actorUserId,
  });

  const current = await listMembershipGroupIds(tenantId, input.membershipId, opts);
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);

  for (const groupId of desired) {
    if (currentSet.has(groupId)) continue;
    await addGroupMember(tenantId, groupId, actorUserId, {
      membershipId: input.membershipId,
      userId: input.userId,
      displayName: input.displayName,
      email: input.email,
    });
  }

  for (const groupId of current) {
    if (desiredSet.has(groupId)) continue;
    await removeGroupMember(tenantId, groupId, input.membershipId, opts);
  }

  return listMembershipGroupIds(tenantId, input.membershipId, opts);
}
