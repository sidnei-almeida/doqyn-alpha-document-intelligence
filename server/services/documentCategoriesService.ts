import { randomUUID } from 'node:crypto';
import type { MongoDocumentCategory } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import { isDocumentGroupId } from '../utils/entityIds.js';
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

export function serializeDocumentCategory(category: MongoDocumentCategory) {
  return {
    id: category._id,
    tenantId: category.tenantId ?? category.companyId,
    companyId: category.companyId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    active: category.active,
    keywords: category.keywords,
    negativeKeywords: category.negativeKeywords ?? [],
    examples: category.examples ?? [],
    iconKey: category.iconKey ?? 'file-text',
    color: category.color ?? 'neutral',
    sortOrder: category.sortOrder ?? 0,
    notifyOnUpdate: category.notifyOnUpdate ?? false,
    notifyGroups: category.notifyGroups ?? [],
    scope: category.scope,
    createdByUserId: category.createdBy,
    createdBy: category.createdBy,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function listDocumentCategories(tenantId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const categories = await collections.documentCategories
    .find(scope)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();

  return (categories as MongoDocumentCategory[]).map(serializeDocumentCategory);
}

export async function createDocumentCategory(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    description?: string;
    keywords?: string[];
    negativeKeywords?: string[];
    examples?: string[];
    iconKey?: string;
    color?: string;
    slug?: string;
    sortOrder?: number;
    scope?: 'global' | 'tenant';
  },
) {
  const name = input.name?.trim();
  if (!name) {
    throw new ServiceError('Nome da categoria é obrigatório.', 'VALIDATION_ERROR', 400);
  }

  const slug = input.slug?.trim() ? slugifyName(input.slug) : slugifyName(name);
  if (!slug) {
    throw new ServiceError('Slug inválido.', 'VALIDATION_ERROR', 400);
  }

  const { collections, scope, storage } = await resolveContext(tenantId, { ownerUserId: userId });

  const duplicateSlug = await collections.documentCategories.findOne({
    ...scope,
    slug,
  } as Record<string, unknown>);

  if (duplicateSlug) {
    throw new ServiceError('Já existe uma categoria com este slug.', 'DUPLICATE_SLUG', 409);
  }

  // Sem escopo de tenant de propósito: `_id` é global na coleção compartilhada, então checar dentro
  // do tenant não enxerga a `cat_contratos` da empresa vizinha e o insert estoura E11000. "Contratos"
  // e "Financeiro" são nomes que toda empresa usa.
  let id = `cat_${slug.replace(/-/g, '_')}`;
  const existingId = await collections.documentCategories.findOne({ _id: id } as Record<string, unknown>);

  if (existingId) {
    id = `cat_${randomUUID().slice(0, 8)}`;
  }

  const now = new Date();
  const category = withClassRuleFieldsFromContext(
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
      examples: input.examples ?? [],
      sortOrder: input.sortOrder ?? 0,
      notifyOnUpdate: false,
      notifyGroups: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
    { scope: input.scope },
  ) as MongoDocumentCategory;

  await collections.documentCategories.insertOne(category as Record<string, unknown>);

  return serializeDocumentCategory(category);
}

export async function updateDocumentCategory(
  tenantId: string,
  categoryId: string,
  input: {
    name?: string;
    description?: string;
    keywords?: string[];
    negativeKeywords?: string[];
    examples?: string[];
    iconKey?: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  },
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Categoria documental não encontrada.', 'NOT_FOUND', 404);
  }

  const patch: Partial<MongoDocumentCategory> = { updatedAt: new Date() };

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
  if (input.examples !== undefined) patch.examples = input.examples;
  if (input.iconKey !== undefined) patch.iconKey = input.iconKey.trim() || 'file-text';
  if (input.color !== undefined) patch.color = input.color.trim() || 'neutral';
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;

  await collections.documentCategories.updateOne(
    { ...scope, _id: categoryId } as Record<string, unknown>,
    { $set: patch },
  );

  const updated = await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  return serializeDocumentCategory(updated as MongoDocumentCategory);
}

export async function toggleDocumentCategoryActive(
  tenantId: string,
  categoryId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const existing = await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  if (!existing) {
    throw new ServiceError('Categoria documental não encontrada.', 'NOT_FOUND', 404);
  }

  const active = !(existing as MongoDocumentCategory).active;
  await collections.documentCategories.updateOne(
    { ...scope, _id: categoryId } as Record<string, unknown>,
    { $set: { active, updatedAt: new Date() } },
  );

  return { id: categoryId, active };
}

export async function assertDocumentCategoryExists(
  tenantId: string,
  categoryId: string,
  opts?: ServiceOpts,
) {
  if (isDocumentGroupId(categoryId)) {
    throw new ServiceError(
      'ID de grupo (group_*) não pode ser usado como classe de documento. Use um ID cat_*.',
      'INVALID_CATEGORY_ID',
      400,
    );
  }

  const { collections, scope } = await resolveContext(tenantId, opts);
  const category = await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  if (!category) {
    throw new ServiceError('Categoria documental não encontrada.', 'CATEGORY_NOT_FOUND', 404);
  }

  return category as MongoDocumentCategory;
}

export async function countGroupsWithAccessToCategory(
  tenantId: string,
  categoryId: string,
  opts?: ServiceOpts,
): Promise<number> {
  const { collections, scope } = await resolveContext(tenantId, opts);
  return collections.documentRules.countDocuments({
    ...scope,
    categoryId,
    active: true,
  });
}
