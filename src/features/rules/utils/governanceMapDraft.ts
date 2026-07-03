import {
  DEFAULT_CONNECTION_PERMISSIONS,
  type GovernanceEdge,
} from './governanceConnections';

export type GovernanceEdgeDiff = {
  added: GovernanceEdge[];
  removed: GovernanceEdge[];
};

export function buildEdgeId(categoryId: string, groupId: string): string {
  return `${categoryId}:${groupId}`;
}

export function createGovernanceEdge(
  categoryId: string,
  groupId: string,
  permissions = DEFAULT_CONNECTION_PERMISSIONS,
): GovernanceEdge {
  return {
    id: buildEdgeId(categoryId, groupId),
    sourceType: 'category',
    sourceId: categoryId,
    targetType: 'documentGroup',
    targetId: groupId,
    permissions: { ...permissions },
  };
}

export function cloneGovernanceEdges(edges: GovernanceEdge[]): GovernanceEdge[] {
  return edges.map((edge) => ({
    ...edge,
    permissions: { ...edge.permissions },
  }));
}

export function governanceEdgesEqual(a: GovernanceEdge[], b: GovernanceEdge[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((edge) => edge.id));
  for (const edge of b) {
    if (!ids.has(edge.id)) return false;
  }
  return true;
}

export function diffGovernanceEdges(
  originalEdges: GovernanceEdge[],
  draftEdges: GovernanceEdge[],
): GovernanceEdgeDiff {
  const originalIds = new Set(originalEdges.map((edge) => edge.id));
  const draftIds = new Set(draftEdges.map((edge) => edge.id));

  return {
    added: draftEdges.filter((edge) => !originalIds.has(edge.id)),
    removed: originalEdges.filter((edge) => !draftIds.has(edge.id)),
  };
}

export function countGovernanceEdgeChanges(
  originalEdges: GovernanceEdge[],
  draftEdges: GovernanceEdge[],
): number {
  const { added, removed } = diffGovernanceEdges(originalEdges, draftEdges);
  return added.length + removed.length;
}

export function serializeGovernanceEdgeIds(edges: GovernanceEdge[]): string {
  return JSON.stringify(edges.map((edge) => edge.id).sort());
}
