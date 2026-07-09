import type { Edge, Node } from '@xyflow/react';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';

/** Posição viva {x,y} de um node no canvas de governança. */
export type FlowPosition = { x: number; y: number };

/** Mapa nodeId → posição (apenas overrides; nodes sem entrada usam o layout padrão). */
export type FlowPositionMap = Record<string, FlowPosition>;

export type CategoryLink = {
  groupId: string;
  groupName: string;
  permissions: DocumentAccessPermissions;
};

export type GroupLink = {
  categoryId: string;
  categoryName: string;
  permissions: DocumentAccessPermissions;
};

export type CategoryCardNodeData = {
  category: DocumentCategory;
  connectedGroupCount: number;
  connectedLinks: CategoryLink[];
  hasExtractionConfig: boolean;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  connectMode: boolean;
  connectGroupName?: string;
  isAdmin: boolean;
  onSelect: () => void;
  onOpenConnection: (groupId: string) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
};

export type GroupCardNodeData = {
  group: Group;
  memberCount: number;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  connectSource: boolean;
  isAdmin: boolean;
  connectedLinks: GroupLink[];
  onSelect: () => void;
  onStartConnect?: () => void;
  onDisconnectFromCategory?: (categoryId: string) => void;
  onOpenConnection: (categoryId: string) => void;
  onMemberCountClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
};

export type PermissionEdgeData = {
  categoryName: string;
  groupName: string;
  canRemove: boolean;
  onRemove: (edgeId: string) => void;
};

export type CategoryFlowNode = Node<CategoryCardNodeData, 'categoryCard'>;
export type GroupFlowNode = Node<GroupCardNodeData, 'groupCard'>;
export type GovernanceFlowNode = CategoryFlowNode | GroupFlowNode;
export type PermissionFlowEdge = Edge<PermissionEdgeData, 'permission'>;

export const CATEGORY_NODE_PREFIX = 'category-';
export const GROUP_NODE_PREFIX = 'group-';

export function categoryNodeId(categoryId: string): string {
  return `${CATEGORY_NODE_PREFIX}${categoryId}`;
}

export function groupNodeId(groupId: string): string {
  return `${GROUP_NODE_PREFIX}${groupId}`;
}

export function parseCategoryNodeId(nodeId: string): string | null {
  return nodeId.startsWith(CATEGORY_NODE_PREFIX)
    ? nodeId.slice(CATEGORY_NODE_PREFIX.length)
    : null;
}

export function parseGroupNodeId(nodeId: string): string | null {
  return nodeId.startsWith(GROUP_NODE_PREFIX) ? nodeId.slice(GROUP_NODE_PREFIX.length) : null;
}
