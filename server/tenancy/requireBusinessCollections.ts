import type { Collection } from 'mongodb';
import { getTenantCollections, type TenantCollections } from './getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type BusinessAdminCollections = TenantCollections & {
  accessGroups: Collection;
  documentClasses: Collection;
  documentRules: Collection;
};

export async function requireBusinessAdminCollections(
  tenantId: string,
): Promise<BusinessAdminCollections> {
  const collections = await getTenantCollections(tenantId);

  if (!collections.documentClasses || !collections.documentRules || !collections.accessGroups) {
    throw new ServiceError(
      'Recursos administrativos indisponíveis para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }

  return collections as BusinessAdminCollections;
}
