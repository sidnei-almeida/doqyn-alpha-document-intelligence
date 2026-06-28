import { randomUUID } from 'node:crypto';
import type {
  MongoDocumentAccessPermissions,
  MongoDocumentAccessRule,
} from '../db/types.js';
import { assertDocumentCategoryExists } from './documentCategoriesService.js';
import { assertDocumentGroupExists } from './documentGroupsService.js';
import { buildClassRuleOwnershipFilter } from '../tenancy/documentOwnership.js';
import { requireTenantGovernanceCollections } from '../tenancy/requireTenantDocumentCollections.js';
import { withClassRuleFieldsFromContext } from '../tenancy/tenantQuery.js';

export type DocumentAccessPermissionKey = keyof MongoDocumentAccessPermissions;

export type DocumentAccessPermissions = MongoDocumentAccessPermissions;

type ServiceOpts = { ownerUserId?: string };

async function resolveContext(tenantId: string, opts?: ServiceOpts) {
  const collections = await requireTenantGovernanceCollections(tenantId, {
    userId: opts?.ownerUserId,
  });
  const scope = buildClassRuleOwnershipFilter(collections.storage);
  return { collections, scope, storage: collections.storage };
}

function hasAnyPermission(permissions: MongoDocumentAccessPermissions): boolean {
  return Object.values(permissions).some(Boolean);
}

export function serializeAccessRule(rule: MongoDocumentAccessRule) {
  return {
    id: rule._id,
    tenantId: rule.tenantId ?? rule.companyId,
    companyId: rule.companyId,
    groupId: rule.groupId,
    categoryId: rule.categoryId,
    permissions: rule.permissions,
    active: rule.active,
    createdByUserId: rule.createdBy,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function listDocumentAccessRules(tenantId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const rules = await collections.documentRules
    .find(scope)
    .sort({ groupId: 1, categoryId: 1 })
    .toArray();

  return (rules as MongoDocumentAccessRule[]).map(serializeAccessRule);
}

export async function upsertAccessRule(
  tenantId: string,
  userId: string,
  input: {
    groupId: string;
    categoryId: string;
    permissions: DocumentAccessPermissions;
  },
) {
  await assertDocumentGroupExists(tenantId, input.groupId, { ownerUserId: userId });
  await assertDocumentCategoryExists(tenantId, input.categoryId, { ownerUserId: userId });

  const { collections, scope, storage } = await resolveContext(tenantId, { ownerUserId: userId });
  const now = new Date();

  if (!hasAnyPermission(input.permissions)) {
    await collections.documentRules.updateMany(
      {
        ...scope,
        groupId: input.groupId,
        categoryId: input.categoryId,
      } as Record<string, unknown>,
      { $set: { active: false, updatedAt: now } },
    );
    return null;
  }

  const existing = await collections.documentRules.findOne({
    ...scope,
    groupId: input.groupId,
    categoryId: input.categoryId,
  } as Record<string, unknown>);

  if (existing) {
    await collections.documentRules.updateOne(
      { ...scope, _id: (existing as MongoDocumentAccessRule)._id } as Record<string, unknown>,
      {
        $set: {
          permissions: input.permissions,
          active: true,
          updatedAt: now,
        },
      },
    );

    const updated = await collections.documentRules.findOne({
      ...scope,
      _id: (existing as MongoDocumentAccessRule)._id,
    } as Record<string, unknown>);

    return serializeAccessRule(updated as MongoDocumentAccessRule);
  }

  const rule = withClassRuleFieldsFromContext(
    storage,
    {
      _id: `rule_${randomUUID().slice(0, 12)}`,
      groupId: input.groupId,
      categoryId: input.categoryId,
      permissions: input.permissions,
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    userId,
  ) as MongoDocumentAccessRule;

  await collections.documentRules.insertOne(rule as Record<string, unknown>);
  return serializeAccessRule(rule);
}

export async function countActiveAccessRules(tenantId: string, opts?: ServiceOpts): Promise<number> {
  const { collections, scope } = await resolveContext(tenantId, opts);
  return collections.documentRules.countDocuments({ ...scope, active: true });
}

export async function resolveCategoryAccessGroupIds(
  tenantId: string,
  categoryId: string,
  opts?: ServiceOpts,
): Promise<{
  viewGroupIds: string[];
  downloadGroupIds: string[];
  updateGroupIds: string[];
  auditGroupIds: string[];
  shareGroupIds: string[];
}> {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const rules = await collections.documentRules
    .find({ ...scope, categoryId, active: true })
    .toArray();

  const result = {
    viewGroupIds: [] as string[],
    downloadGroupIds: [] as string[],
    updateGroupIds: [] as string[],
    auditGroupIds: [] as string[],
    shareGroupIds: [] as string[],
  };

  for (const rule of rules as MongoDocumentAccessRule[]) {
    if (rule.permissions.view) result.viewGroupIds.push(rule.groupId);
    if (rule.permissions.download) result.downloadGroupIds.push(rule.groupId);
    if (rule.permissions.upload) result.updateGroupIds.push(rule.groupId);
    if (rule.permissions.manage) result.auditGroupIds.push(rule.groupId);
    if (rule.permissions.share) result.shareGroupIds.push(rule.groupId);
  }

  return result;
}

export async function countAccessRulesForGroup(tenantId: string, groupId: string, opts?: ServiceOpts) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  return collections.documentRules.countDocuments({ ...scope, groupId, active: true });
}

export async function deactivateAccessRuleById(
  tenantId: string,
  ruleId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  const result = await collections.documentRules.updateOne(
    { ...scope, _id: ruleId } as Record<string, unknown>,
    { $set: { active: false, updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    throw new (await import('../utils/serviceErrors.js')).ServiceError(
      'Regra de acesso não encontrada.',
      'NOT_FOUND',
      404,
    );
  }

  return { id: ruleId, active: false };
}

export async function deactivateAccessRulesForGroup(
  tenantId: string,
  groupId: string,
  opts?: ServiceOpts,
) {
  const { collections, scope } = await resolveContext(tenantId, opts);
  await collections.documentRules.updateMany(
    { ...scope, groupId } as Record<string, unknown>,
    { $set: { active: false, updatedAt: new Date() } },
  );
}
