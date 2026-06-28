import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';
import { readGroupClassPermissions } from './groupClassPermissions';

export type GovernanceConnection = {
  key: string;
  categoryId: string;
  groupId: string;
  permissions: DocumentAccessPermissions;
};

export function listGovernanceConnections(
  categories: DocumentCategory[],
  groups: Group[],
): GovernanceConnection[] {
  const groupIds = new Set(groups.map((group) => group.id));
  const connections: GovernanceConnection[] = [];

  for (const category of categories) {
    const seen = new Set<string>();
    for (const groupId of category.accessGroupIds) {
      if (!groupIds.has(groupId) || seen.has(groupId)) continue;
      seen.add(groupId);
      connections.push({
        key: `${category.id}:${groupId}`,
        categoryId: category.id,
        groupId,
        permissions: readGroupClassPermissions(category, groupId),
      });
    }
  }

  return connections;
}

export function countActivePermissions(permissions: DocumentAccessPermissions): number {
  return Object.values(permissions).filter(Boolean).length;
}

export const DEFAULT_CONNECTION_PERMISSIONS: DocumentAccessPermissions = {
  view: true,
  download: false,
  upload: false,
  share: false,
  manage: false,
};

export const EMPTY_CONNECTION_PERMISSIONS: DocumentAccessPermissions = {
  view: false,
  download: false,
  upload: false,
  share: false,
  manage: false,
};
