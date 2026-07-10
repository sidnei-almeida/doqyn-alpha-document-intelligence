import type { MongoDocumentAccessPermissions, MongoDocumentAccessRule } from '../db/types.js';
import { listDocumentAccessRules } from '../services/documentAccessRulesService.js';

export type GovernancePermissionKey = keyof MongoDocumentAccessPermissions;

export type GovernanceAccessIndex = {
  viewByCategory: Map<string, Set<string>>;
  downloadByCategory: Map<string, Set<string>>;
  updateByCategory: Map<string, Set<string>>;
  auditByCategory: Map<string, Set<string>>;
  shareByCategory: Map<string, Set<string>>;
};

const PERMISSION_BUCKETS: Array<{
  key: GovernancePermissionKey;
  target: keyof GovernanceAccessIndex;
}> = [
  { key: 'view', target: 'viewByCategory' },
  { key: 'download', target: 'downloadByCategory' },
  { key: 'upload', target: 'updateByCategory' },
  { key: 'manage', target: 'auditByCategory' },
  { key: 'share', target: 'shareByCategory' },
];

function createEmptyGovernanceAccessIndex(): GovernanceAccessIndex {
  return {
    viewByCategory: new Map(),
    downloadByCategory: new Map(),
    updateByCategory: new Map(),
    auditByCategory: new Map(),
    shareByCategory: new Map(),
  };
}

function addGroupToCategoryBucket(
  bucket: Map<string, Set<string>>,
  categoryId: string,
  groupId: string,
): void {
  const current = bucket.get(categoryId) ?? new Set<string>();
  current.add(groupId);
  bucket.set(categoryId, current);
}

export function buildGovernanceAccessIndex(
  rules: Pick<MongoDocumentAccessRule, 'categoryId' | 'groupId' | 'permissions' | 'active'>[],
): GovernanceAccessIndex {
  const index = createEmptyGovernanceAccessIndex();

  for (const rule of rules) {
    if (!rule.active) continue;
    if (!rule.categoryId || !rule.groupId) continue;

    for (const { key, target } of PERMISSION_BUCKETS) {
      if (!rule.permissions[key]) continue;
      addGroupToCategoryBucket(index[target], rule.categoryId, rule.groupId);
    }
  }

  return index;
}

export async function loadGovernanceAccessIndex(
  tenantId: string,
  opts?: { ownerUserId?: string },
): Promise<GovernanceAccessIndex> {
  const rules = await listDocumentAccessRules(tenantId, opts);
  return buildGovernanceAccessIndex(
    rules.map((rule) => ({
      categoryId: rule.categoryId,
      groupId: rule.groupId,
      permissions: rule.permissions,
      active: rule.active,
    })),
  );
}

export function userHasGovernanceCategoryPermission(
  index: GovernanceAccessIndex | undefined,
  categoryId: string | undefined,
  memberGroupIds: string[],
  permission: GovernancePermissionKey,
): boolean {
  if (!index || !categoryId?.trim() || memberGroupIds.length === 0) return false;

  const bucket =
    permission === 'view'
      ? index.viewByCategory
      : permission === 'download'
        ? index.downloadByCategory
        : permission === 'upload'
          ? index.updateByCategory
          : permission === 'manage'
            ? index.auditByCategory
            : index.shareByCategory;

  const allowedGroups = bucket.get(categoryId);
  if (!allowedGroups?.size) return false;

  return memberGroupIds.some((groupId) => allowedGroups.has(groupId));
}

export function listGovernanceViewableCategoryIds(
  index: GovernanceAccessIndex,
  memberGroupIds: string[],
): string[] {
  if (memberGroupIds.length === 0) return [];

  const memberGroupSet = new Set(memberGroupIds);
  const categoryIds: string[] = [];

  for (const [categoryId, allowedGroups] of index.viewByCategory.entries()) {
    for (const groupId of allowedGroups) {
      if (memberGroupSet.has(groupId)) {
        categoryIds.push(categoryId);
        break;
      }
    }
  }

  return categoryIds;
}
