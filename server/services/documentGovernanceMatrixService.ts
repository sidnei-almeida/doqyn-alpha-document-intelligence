import type { DocumentAccessPermissions } from './documentAccessRulesService.js';
import { listDocumentAccessRules, upsertAccessRule } from './documentAccessRulesService.js';
import { listDocumentCategories } from './documentCategoriesService.js';
import { listDocumentGroups } from './documentGroupsService.js';
import { listDocumentExtractionRules } from './documentExtractionRulesService.js';

export type DocumentGovernanceMatrix = {
  categories: Awaited<ReturnType<typeof listDocumentCategories>>;
  groups: Awaited<ReturnType<typeof listDocumentGroups>>;
  rules: Awaited<ReturnType<typeof listDocumentAccessRules>>;
  extractionRules: Awaited<ReturnType<typeof listDocumentExtractionRules>>;
};

export async function getDocumentGovernanceMatrix(
  tenantId: string,
  opts?: { ownerUserId?: string },
): Promise<DocumentGovernanceMatrix> {
  const [categories, groups, rules, extractionRules] = await Promise.all([
    listDocumentCategories(tenantId, opts),
    listDocumentGroups(tenantId, opts),
    listDocumentAccessRules(tenantId, opts),
    listDocumentExtractionRules(tenantId, opts),
  ]);

  const activeRules = rules.filter((rule) => rule.active);

  return {
    categories: categories.map((category) => ({
      ...category,
      linkedGroupCount: activeRules.filter((rule) => rule.categoryId === category.id).length,
    })),
    groups: groups.map((group) => ({
      ...group,
      linkedCategoryCount: activeRules.filter((rule) => rule.groupId === group.id).length,
    })),
    rules: activeRules,
    extractionRules,
  };
}

export async function updateDocumentGovernanceMatrixCell(
  tenantId: string,
  userId: string,
  input: {
    groupId: string;
    categoryId: string;
    permissions: DocumentAccessPermissions;
  },
) {
  const rule = await upsertAccessRule(tenantId, userId, input);
  return {
    groupId: input.groupId,
    categoryId: input.categoryId,
    permissions: input.permissions,
    rule,
  };
}

/** @deprecated alias */
export const getDocumentAccessMatrix = getDocumentGovernanceMatrix;
export const updateDocumentAccessMatrix = updateDocumentGovernanceMatrixCell;
