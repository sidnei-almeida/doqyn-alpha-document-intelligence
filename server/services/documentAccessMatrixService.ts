import {
  getDocumentGovernanceMatrix,
  updateDocumentGovernanceMatrixCell,
} from './documentGovernanceMatrixService.js';

export type {
  DocumentAccessPermissionKey,
  DocumentAccessPermissions,
} from './documentAccessRulesService.js';

/** @deprecated use getDocumentGovernanceMatrix */
export const getDocumentAccessMatrix = getDocumentGovernanceMatrix;

/** @deprecated use updateDocumentGovernanceMatrixCell */
export const updateDocumentAccessMatrix = updateDocumentGovernanceMatrixCell;

export async function countLinkedClassesForGroup(tenantId: string, groupId: string): Promise<number> {
  const matrix = await getDocumentGovernanceMatrix(tenantId);
  return matrix.groups.find((group) => group.id === groupId)?.linkedCategoryCount ?? 0;
}
