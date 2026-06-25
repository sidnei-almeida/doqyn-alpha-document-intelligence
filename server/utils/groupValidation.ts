import { fetchTenantAccessGroupsFromAuth } from '../integrations/authAccessGroups.js';
import { ServiceError } from '../utils/serviceErrors.js';

/**
 * Valida IDs de grupos contra o auth-service/Postgres (fonte de verdade).
 * Mongo access_groups_* não é mais usado em runtime.
 */
export async function assertGroupIdsExist(
  tenantId: string,
  groupIds: string[],
  options?: { requireActive?: boolean },
): Promise<void> {
  if (!groupIds.length) return;

  const unique = [...new Set(groupIds)];
  const groups = await fetchTenantAccessGroupsFromAuth(tenantId);
  const requireActive = options?.requireActive !== false;

  const validIds = new Set(
    groups
      .filter((g) => !requireActive || g.status === 'active')
      .map((g) => g.groupId),
  );

  const missing = unique.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    throw new ServiceError(
      'Um ou mais grupos informados não existem ou estão inativos.',
      'INVALID_GROUP_IDS',
      400,
    );
  }
}
