import { randomUUID } from 'node:crypto';
import type { MongoDocumentCategory } from '../db/types.js';
import { ensureDefaultExtractionRule } from './documentDefaultExtractionRule.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { slugifyName } from '../utils/slugify.js';
import { isDocumentGroupId } from '../utils/entityIds.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import {
  tenantScopeFilterFromContext,
  withClassRuleFieldsFromContext,
} from '../tenancy/tenantQuery.js';

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
  const existingId = await collections.documentCategories.findOne({ _id: id } as Record<
    string,
    unknown
  >);

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

  // Categoria sem regra ativa é uma pasta que não aceita documento: a confirmação exige classe E
  // regra (`getMongoClassAndRule`) e o classificador só recebe as classes que têm regra. Nasce com
  // a regra padrão para que a categoria funcione desde já; quem quiser campos próprios edita depois.
  await ensureDefaultExtractionRule(tenantId, category._id, userId);

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

  /**
   * O nome novo alcança os documentos que já estão dentro.
   *
   * `documents.className` é uma cópia, e é dela que a Biblioteca lê o rótulo do cartão — não há
   * junção com a categoria na listagem. Sem esta propagação, renomear mudaria o nome da pasta e
   * deixaria todo documento dentro dela anunciando o nome antigo.
   *
   * A versão também acompanha, pelo mesmo motivo que `documentMoveService` a atualiza ao mover:
   * `classification` aqui é onde o documento está, e não um registro histórico do que a IA disse.
   */
  if (patch.name && patch.name !== existing.name) {
    const documentFilter = {
      ...tenantScopeFilterFromContext(collections.storage),
      classId: categoryId,
    } as Record<string, unknown>;

    await collections.documents.updateMany(documentFilter, {
      $set: { className: patch.name, updatedAt: new Date() },
    });
    await collections.documentVersions.updateMany(
      {
        ...tenantScopeFilterFromContext(collections.storage),
        'classification.classId': categoryId,
      } as Record<string, unknown>,
      { $set: { 'classification.className': patch.name } },
    );
  }

  const updated = await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  return serializeDocumentCategory(updated as MongoDocumentCategory);
}

/**
 * Apaga a categoria e devolve os documentos dela para Sem categoria.
 *
 * **Apagar de verdade, e não desativar.** Categoria desativada com documento dentro é um terceiro
 * estado que ninguém vê na tela e que toda consulta precisa aprender a ignorar — o tipo de resto
 * que volta a morder meses depois. O que se perde aqui é a pasta e as regras dela; documento
 * nenhum some.
 *
 * As regras vão junto porque sem a categoria elas não têm o que classificar: extração órfã fica
 * pendurada num `categoryId` que não existe, e volta a valer sozinha no dia em que alguém criar
 * outra categoria que caia no mesmo id.
 */
export async function deleteDocumentCategory(
  tenantId: string,
  categoryId: string,
  userId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);

  const existing = (await collections.documentCategories.findOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>)) as MongoDocumentCategory | null;

  if (!existing) {
    throw new ServiceError('Categoria documental não encontrada.', 'NOT_FOUND', 404);
  }

  // Sem categoria é o destino de todo mundo: apagá-la deixaria a exclusão da próxima sem para onde
  // mandar os documentos.
  if (existing.slug === UNCATEGORIZED_CATEGORY_SLUG) {
    throw new ServiceError(
      'Sem categoria não pode ser excluída: é para onde vão os documentos das categorias apagadas.',
      'CATEGORY_PROTECTED',
      400,
    );
  }

  const targetId = await ensureUncategorizedCategory(tenantId, userId);
  const documentScope = tenantScopeFilterFromContext(collections.storage);

  const moved = await collections.documents.updateMany(
    { ...documentScope, classId: categoryId } as Record<string, unknown>,
    {
      $set: {
        classId: targetId,
        className: UNCATEGORIZED_CATEGORY_NAME,
        previousClassId: categoryId,
        updatedAt: new Date(),
      },
    },
  );

  await collections.documentVersions.updateMany(
    { ...documentScope, 'classification.classId': categoryId } as Record<string, unknown>,
    {
      $set: {
        'classification.classId': targetId,
        'classification.className': UNCATEGORIZED_CATEGORY_NAME,
      },
    },
  );

  await collections.documentExtractionRules.deleteMany({
    ...scope,
    categoryId,
  } as Record<string, unknown>);
  await collections.documentRules.deleteMany({ ...scope, categoryId } as Record<string, unknown>);
  await collections.documentCategories.deleteOne({
    ...scope,
    _id: categoryId,
  } as Record<string, unknown>);

  return {
    id: categoryId,
    name: existing.name,
    movedDocuments: moved.modifiedCount,
    targetCategoryId: targetId,
  };
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

/** Slug da pasta onde cai o documento que a IA não soube classificar. */
export const UNCATEGORIZED_CATEGORY_SLUG = 'sem-categoria';
export const UNCATEGORIZED_CATEGORY_NAME = 'Sem categoria';

/**
 * Garante a categoria "Sem categoria" do tenant e devolve o id dela.
 *
 * Existe porque `classId` é estrutural: é obrigatório no documento e na versão, e as regras de
 * acesso são chaveadas por classe. Um documento sem classificação não tinha onde existir, então
 * ficava só no R2 — invisível na Biblioteca, impossível de reclassificar ou apagar. Como categoria
 * de verdade, ele aparece numa pasta e o resto do sistema não precisa saber que ela é especial.
 *
 * Idempotente: chamada na provisão do tenant e de novo na confirmação, para tenant provisionado
 * antes desta pasta existir.
 */
export async function ensureUncategorizedCategory(
  tenantId: string,
  userId: string,
): Promise<string> {
  const { collections, scope } = await resolveContext(tenantId, { ownerUserId: userId });

  const existing = await collections.documentCategories.findOne({
    ...scope,
    slug: UNCATEGORIZED_CATEGORY_SLUG,
  } as Record<string, unknown>);

  if (existing) return (existing as MongoDocumentCategory)._id;

  try {
    const created = await createDocumentCategory(tenantId, userId, {
      name: UNCATEGORIZED_CATEGORY_NAME,
      slug: UNCATEGORIZED_CATEGORY_SLUG,
      description:
        'Documentos que chegaram sem classificação. Reclassifique quando souber onde eles moram.',
      iconKey: 'folder',
      color: 'neutral',
      // Última na lista: é destino de exceção, não uma escolha que se oferece primeiro.
      sortOrder: 999,
    });

    return created.id;
  } catch (error) {
    // Dois envios sem classe confirmando ao mesmo tempo chegam aqui juntos: ambos leem "não existe"
    // e ambos tentam criar. Perder a corrida não é erro — a pasta que o outro criou serve.
    const isDuplicate =
      error instanceof ServiceError
        ? error.code === 'DUPLICATE_SLUG'
        : /E11000|duplicate key/i.test(error instanceof Error ? error.message : '');

    if (!isDuplicate) throw error;

    const raced = await collections.documentCategories.findOne({
      ...scope,
      slug: UNCATEGORIZED_CATEGORY_SLUG,
    } as Record<string, unknown>);

    if (!raced) throw error;
    return (raced as MongoDocumentCategory)._id;
  }
}
