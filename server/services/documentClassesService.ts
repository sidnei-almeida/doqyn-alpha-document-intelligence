import { randomUUID } from 'node:crypto';
import type { MongoDocumentClass, MongoDocumentClassPermissions } from '../db/types.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { classIdFromSlug, slugifyName } from '../utils/slugify.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { withClassRuleFieldsFromContext } from '../tenancy/tenantQuery.js';

type ClassServiceOpts = { ownerUserId?: string };

async function resolveClassContext(tenantId: string, opts?: ClassServiceOpts) {
  const collections = await requireTenantGovernanceCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  const scope = buildClassRuleOwnershipFilter(collections.storage);
  return { collections, scope, storage: collections.storage };
}

function emptyPermissions(): MongoDocumentClassPermissions {
  return { view: [], download: [], update: [], audit: [], share: [] };
}

function serializeDocumentClass(docClass: MongoDocumentClass) {
  return {
    id: docClass._id,
    tenantId: docClass.tenantId ?? docClass.companyId,
    companyId: docClass.companyId,
    name: docClass.name,
    slug: docClass.slug,
    description: docClass.description,
    active: docClass.active,
    iconKey: docClass.iconKey,
    color: docClass.color,
    keywords: docClass.keywords,
    negativeKeywords: docClass.negativeKeywords ?? [],
    permissions: docClass.permissions,
    notifyOnUpdate: docClass.notifyOnUpdate,
    notifyGroups: docClass.notifyGroups,
    scope: (docClass as Record<string, unknown>).scope,
    createdBy: docClass.createdBy,
    createdAt: docClass.createdAt.toISOString(),
    updatedAt: docClass.updatedAt.toISOString(),
  };
}

export async function listDocumentClasses(tenantId: string, opts?: ClassServiceOpts) {
  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const classes = await collections.documentCategories
    .find(scope)
    .sort({ name: 1 })
    .toArray();

  return (classes as MongoDocumentClass[]).map(serializeDocumentClass);
}

export async function createDocumentClass(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    description?: string;
    keywords?: string[];
    negativeKeywords?: string[];
    iconKey?: string;
    color?: string;
    slug?: string;
    scope?: 'global' | 'tenant';
  },
) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceError('Nome da classe é obrigatório.', 'VALIDATION_ERROR', 400);
  }

  const slug = input.slug?.trim() ? slugifyName(input.slug) : slugifyName(name);
  if (!slug) {
    throw new ServiceError('Slug inválido.', 'VALIDATION_ERROR', 400);
  }

  const { collections, scope, storage } = await resolveClassContext(tenantId, { ownerUserId: userId });

  const duplicateSlug = await collections.documentCategories.findOne({
    ...scope,
    slug,
  } as Record<string, unknown>);

  if (duplicateSlug) {
    throw new ServiceError('Já existe uma classe com este slug.', 'DUPLICATE_SLUG', 409);
  }

  let id = classIdFromSlug(slug);
  const existingId = await collections.documentCategories.findOne({
    ...scope,
    _id: id,
  } as Record<string, unknown>);

  if (existingId) {
    id = `class_${randomUUID().slice(0, 8)}`;
  }

  const now = new Date();
  const docClass = withClassRuleFieldsFromContext(
    storage,
    {
      _id: id,
      name,
      slug,
      description: input.description?.trim() || '',
      active: true,
      iconKey: input.iconKey?.trim() || 'file-text',
      color: input.color?.trim() || 'neutral',
      keywords: input.keywords ?? [],
      negativeKeywords: input.negativeKeywords ?? [],
      permissions: emptyPermissions(),
      notifyOnUpdate: false,
      notifyGroups: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
    { scope: input.scope },
  ) as MongoDocumentClass;

  await collections.documentCategories.insertOne(docClass as Record<string, unknown>);

  return serializeDocumentClass(docClass);
}

export async function updateDocumentClass(
  tenantId: string,
  classId: string,
  input: {
    name?: string;
    description?: string;
    keywords?: string[];
    negativeKeywords?: string[];
    iconKey?: string;
    color?: string;
    active?: boolean;
  },
  opts?: ClassServiceOpts,
) {
  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Classe documental não encontrada.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoDocumentClass> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ServiceError('Nome não pode ser vazio.', 'VALIDATION_ERROR', 400);
    }
    patch.name = name;
  }

  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.keywords !== undefined) patch.keywords = input.keywords;
  if (input.negativeKeywords !== undefined) patch.negativeKeywords = input.negativeKeywords;
  if (input.iconKey !== undefined) patch.iconKey = input.iconKey.trim() || 'file-text';
  if (input.color !== undefined) patch.color = input.color.trim() || 'neutral';
  if (input.active !== undefined) patch.active = input.active;

  await collections.documentCategories.updateOne({ ...scope, _id: classId } as Record<string, unknown>, {
    $set: patch,
  });

  const updated = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  return serializeDocumentClass(updated as MongoDocumentClass);
}

export async function toggleDocumentClassActive(
  tenantId: string,
  classId: string,
  opts?: ClassServiceOpts,
) {
  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Classe documental não encontrada.', 'NOT_FOUND', 404);
  }

  const active = !(existing as MongoDocumentClass).active;
  await collections.documentCategories.updateOne({ ...scope, _id: classId } as Record<string, unknown>, {
    $set: { active, updatedAt: new Date() },
  });

  return { id: classId, active };
}

export async function updateDocumentClassPermissions(
  tenantId: string,
  classId: string,
  viewGroupIds: string[],
  opts?: ClassServiceOpts,
) {
  await assertGroupIdsExist(tenantId, viewGroupIds);

  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Classe documental não encontrada.', 'NOT_FOUND', 404);
  }

  const permissions: MongoDocumentClassPermissions = {
    view: viewGroupIds,
    download: (existing as MongoDocumentClass).permissions?.download ?? [],
    update: (existing as MongoDocumentClass).permissions?.update ?? [],
    audit: (existing as MongoDocumentClass).permissions?.audit ?? [],
    share: (existing as MongoDocumentClass).permissions?.share ?? [],
  };

  await collections.documentCategories.updateOne({ ...scope, _id: classId } as Record<string, unknown>, {
    $set: { permissions, updatedAt: new Date() },
  });

  const updated = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  return serializeDocumentClass(updated as MongoDocumentClass);
}

export async function updateDocumentClassNotifications(
  tenantId: string,
  classId: string,
  input: { notifyOnUpdate: boolean; notifyGroups?: string[] },
  opts?: ClassServiceOpts,
) {
  const notifyGroups = input.notifyGroups ?? [];
  await assertGroupIdsExist(tenantId, notifyGroups);

  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Classe documental não encontrada.', 'NOT_FOUND', 404);
  }

  await collections.documentCategories.updateOne({ ...scope, _id: classId } as Record<string, unknown>, {
    $set: {
      notifyOnUpdate: input.notifyOnUpdate,
      notifyGroups,
      updatedAt: new Date(),
    },
  });

  const updated = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  return serializeDocumentClass(updated as MongoDocumentClass);
}

export async function assertDocumentClassExists(
  tenantId: string,
  classId: string,
  opts?: ClassServiceOpts,
) {
  const { collections, scope } = await resolveClassContext(tenantId, opts);
  const docClass = await collections.documentCategories.findOne({
    ...scope,
    _id: classId,
  } as Record<string, unknown>);

  if (!docClass) {
    throw new ServiceError('Classe documental não encontrada.', 'CLASS_NOT_FOUND', 404);
  }

  return docClass;
}
