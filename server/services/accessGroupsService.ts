import type { MongoAccessGroup } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { groupIdFromSlug, slugifyName } from '../utils/slugify.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilter, withTenantFields } from '../tenancy/tenantQuery.js';

function serializeGroup(group: MongoAccessGroup) {
  return {
    id: group._id,
    tenantId: group.tenantId ?? group.companyId,
    companyId: group.companyId,
    name: group.name,
    slug: group.slug,
    color: group.color,
    active: group.active,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

async function requireAccessGroupsCollection(tenantId: string) {
  const tenantCollections = await getTenantCollections(tenantId);
  if (!tenantCollections.accessGroups) {
    throw new ServiceError(
      'Grupos de acesso não disponíveis para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }
  return tenantCollections.accessGroups;
}

export async function listAccessGroups(tenantId: string) {
  const collection = await requireAccessGroupsCollection(tenantId);
  const groups = await collection
    .find(tenantScopeFilter(tenantId))
    .sort({ name: 1 })
    .toArray();

  return groups.map(serializeGroup);
}

export async function createAccessGroup(
  tenantId: string,
  input: { name: string; color?: string },
) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceError('Nome do grupo é obrigatório.', 'VALIDATION_ERROR', 400);
  }

  const slug = slugifyName(name);
  if (!slug) {
    throw new ServiceError('Não foi possível gerar slug para o grupo.', 'VALIDATION_ERROR', 400);
  }

  const collection = await requireAccessGroupsCollection(tenantId);
  const scope = tenantScopeFilter(tenantId);

  const duplicateSlug = await collection.findOne({
    ...scope,
    slug,
  } as Record<string, unknown>);

  if (duplicateSlug) {
    throw new ServiceError('Já existe um grupo com slug equivalente.', 'DUPLICATE_SLUG', 409);
  }

  let id = groupIdFromSlug(slug);
  const existingId = await collection.findOne({
    ...scope,
    _id: id,
  } as Record<string, unknown>);

  if (existingId) {
    id = `${id}_${Date.now().toString(36)}`;
  }

  const now = new Date();
  const group = withTenantFields(tenantId, {
    _id: id,
    name,
    slug,
    color: input.color?.trim() || 'neutral',
    active: true,
    createdAt: now,
    updatedAt: now,
  }) as MongoAccessGroup;

  await collection.insertOne(group);

  return serializeGroup(group);
}

export async function updateAccessGroup(
  tenantId: string,
  groupId: string,
  input: { name?: string; color?: string; active?: boolean },
) {
  const collection = await requireAccessGroupsCollection(tenantId);
  const scope = tenantScopeFilter(tenantId);

  const existing = await collection.findOne({
    ...scope,
    _id: groupId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Grupo não encontrado.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoAccessGroup> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ServiceError('Nome do grupo não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    patch.name = name;
  }

  if (input.color !== undefined) {
    patch.color = input.color.trim() || 'neutral';
  }

  if (input.active !== undefined) {
    patch.active = input.active;
  }

  await collection.updateOne({ ...scope, _id: groupId } as Record<string, unknown>, {
    $set: patch,
  });

  const updated = await collection.findOne({
    ...scope,
    _id: groupId,
  } as Record<string, unknown>);

  return serializeGroup(updated!);
}

export async function toggleAccessGroupActive(tenantId: string, groupId: string) {
  const collection = await requireAccessGroupsCollection(tenantId);
  const scope = tenantScopeFilter(tenantId);

  const existing = await collection.findOne({
    ...scope,
    _id: groupId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Grupo não encontrado.', 'NOT_FOUND', 404);
  }

  const active = !existing.active;
  await collection.updateOne({ ...scope, _id: groupId } as Record<string, unknown>, {
    $set: { active, updatedAt: new Date() },
  });

  return { id: groupId, active };
}
