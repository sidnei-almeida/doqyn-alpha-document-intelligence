import { assertDocumentGroupExists } from '../services/documentGroupsService.js';
import { ServiceError } from '../utils/serviceErrors.js';

/**
 * Valida IDs de grupos documentais contra o MongoDB (fonte de verdade da governança).
 */
export async function assertGroupIdsExist(
  tenantId: string,
  groupIds: string[],
  options?: { requireActive?: boolean; ownerUserId?: string },
): Promise<void> {
  if (!groupIds.length) return;

  const unique = [...new Set(groupIds)];
  const requireActive = options?.requireActive !== false;

  for (const groupId of unique) {
    try {
      if (requireActive) {
        await assertDocumentGroupExists(tenantId, groupId, {
          ownerUserId: options?.ownerUserId,
        });
      }
    } catch {
      throw new ServiceError(
        'Um ou mais grupos informados não existem ou estão inativos.',
        'INVALID_GROUP_IDS',
        400,
      );
    }
  }
}
