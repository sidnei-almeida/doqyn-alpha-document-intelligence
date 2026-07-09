import type { GovernanceEdge } from '../utils/governanceConnections';
import { buildEdgeId } from '../utils/governanceMapDraft';
import { parseCategoryNodeId, parseGroupNodeId } from './types';

/**
 * Regras de conexão do mapa: apenas categoria → grupo documental,
 * sem self-connection e sem duplicar uma conexão existente no draft.
 */
export function isValidGovernanceConnection(
  sourceNodeId: string | null | undefined,
  targetNodeId: string | null | undefined,
  draftEdges: GovernanceEdge[],
): boolean {
  if (!sourceNodeId || !targetNodeId) return false;
  if (sourceNodeId === targetNodeId) return false;

  const categoryId = parseCategoryNodeId(sourceNodeId);
  const groupId = parseGroupNodeId(targetNodeId);
  if (!categoryId || !groupId) return false;

  const edgeId = buildEdgeId(categoryId, groupId);
  return !draftEdges.some((edge) => edge.id === edgeId);
}
