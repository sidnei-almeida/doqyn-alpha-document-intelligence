import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilter } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';

export async function assertGroupIdsExist(
  tenantId: string,
  groupIds: string[],
  options?: { requireActive?: boolean },
): Promise<void> {
  if (!groupIds.length) return;

  const unique = [...new Set(groupIds)];
  const tenantCollections = await getTenantCollections(tenantId);

  if (!tenantCollections.accessGroups) {
    throw new ServiceError(
      'Grupos de acesso não disponíveis para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }

  const filter: Record<string, unknown> = {
    ...tenantScopeFilter(tenantId),
    _id: { $in: unique },
  };
  if (options?.requireActive !== false) {
    filter.active = true;
  }

  const found = await tenantCollections.accessGroups.countDocuments(filter);

  if (found !== unique.length) {
    throw new ServiceError(
      'Um ou mais grupos informados não existem ou estão inativos.',
      'INVALID_GROUP_IDS',
      400,
    );
  }
}
