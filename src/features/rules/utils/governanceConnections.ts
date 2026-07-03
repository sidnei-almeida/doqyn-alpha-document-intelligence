import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';
import { readGroupClassPermissions } from './groupClassPermissions';

export type GovernanceConnection = {
  key: string;
  categoryId: string;
  groupId: string;
  permissions: DocumentAccessPermissions;
};

/** Relação visual categoria → grupo documental para o mapa de governança. */
export type GovernanceEdge = {
  id: string;
  sourceType: 'category';
  sourceId: string;
  targetType: 'documentGroup';
  targetId: string;
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

export function listGovernanceEdges(
  categories: DocumentCategory[],
  groups: Group[],
): GovernanceEdge[] {
  return listGovernanceConnections(categories, groups).map((connection) => ({
    id: connection.key,
    sourceType: 'category' as const,
    sourceId: connection.categoryId,
    targetType: 'documentGroup' as const,
    targetId: connection.groupId,
    permissions: connection.permissions,
  }));
}

export function connectionToEdge(connection: GovernanceConnection): GovernanceEdge {
  return {
    id: connection.key,
    sourceType: 'category',
    sourceId: connection.categoryId,
    targetType: 'documentGroup',
    targetId: connection.groupId,
    permissions: connection.permissions,
  };
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
