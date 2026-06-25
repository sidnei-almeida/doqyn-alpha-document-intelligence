import { ServiceError } from '../utils/serviceErrors.js';

/**
 * @deprecated Grupos de acesso são fonte de verdade no auth-service/Postgres.
 * Use GET /auth/admin/access-groups ou /internal/tenants/:tenantId/access-groups.
 * Mongo access_groups_* é legado e não deve ser escrito em runtime.
 */

const DEPRECATED_MESSAGE =
  'Grupos de acesso são gerenciados pelo auth-service. Use /auth/admin/access-groups.';

export async function listAccessGroups(): Promise<never> {
  throw new ServiceError(DEPRECATED_MESSAGE, 'ACCESS_GROUPS_MONGO_DEPRECATED', 410);
}

export async function createAccessGroup(): Promise<never> {
  throw new ServiceError(DEPRECATED_MESSAGE, 'ACCESS_GROUPS_MONGO_DEPRECATED', 410);
}

export async function updateAccessGroup(): Promise<never> {
  throw new ServiceError(DEPRECATED_MESSAGE, 'ACCESS_GROUPS_MONGO_DEPRECATED', 410);
}

export async function toggleAccessGroupActive(): Promise<never> {
  throw new ServiceError(DEPRECATED_MESSAGE, 'ACCESS_GROUPS_MONGO_DEPRECATED', 410);
}
