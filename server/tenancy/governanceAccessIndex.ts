import type { MongoDocumentAccessPermissions, MongoDocumentAccessRule } from '../db/types.js';
import { listDocumentAccessRules } from '../services/documentAccessRulesService.js';

/**
 * Verbo de autorização, na linguagem do domínio.
 *
 * Deliberadamente **não** é `keyof MongoDocumentAccessPermissions`. Os campos persistidos ainda se
 * chamam `upload` e `manage` por herança do primeiro desenho, mas os buckets que eles alimentam
 * sempre foram `updateByCategory` e `auditByCategory`, e o frontend já fala `update`/`audit` no seu
 * modelo de domínio (`src/features/rules/api/rulesApi.ts`). O único lugar que ainda obrigava a
 * autorização a falar `'upload'` para perguntar "pode alterar?" era este alias.
 *
 * Renomear o campo persistido exigiria migração de dados no Mongo por ganho puramente cosmético;
 * renomear o verbo não custa nada e deixa o call site honesto.
 */
export type GovernancePermissionKey = 'view' | 'download' | 'update' | 'audit' | 'share';

export type GovernanceAccessIndex = {
  viewByCategory: Map<string, Set<string>>;
  downloadByCategory: Map<string, Set<string>>;
  updateByCategory: Map<string, Set<string>>;
  auditByCategory: Map<string, Set<string>>;
  shareByCategory: Map<string, Set<string>>;
};

/** Tradução campo persistido → bucket. É a única fronteira que conhece os nomes legados. */
const PERMISSION_BUCKETS: Array<{
  storedKey: keyof MongoDocumentAccessPermissions;
  target: keyof GovernanceAccessIndex;
}> = [
  { storedKey: 'view', target: 'viewByCategory' },
  { storedKey: 'download', target: 'downloadByCategory' },
  { storedKey: 'upload', target: 'updateByCategory' },
  { storedKey: 'manage', target: 'auditByCategory' },
  { storedKey: 'share', target: 'shareByCategory' },
];

const BUCKET_BY_PERMISSION: Record<GovernancePermissionKey, keyof GovernanceAccessIndex> = {
  view: 'viewByCategory',
  download: 'downloadByCategory',
  update: 'updateByCategory',
  audit: 'auditByCategory',
  share: 'shareByCategory',
};

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

    for (const { storedKey, target } of PERMISSION_BUCKETS) {
      if (!rule.permissions[storedKey]) continue;
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

  const allowedGroups = index[BUCKET_BY_PERMISSION[permission]].get(categoryId);
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
