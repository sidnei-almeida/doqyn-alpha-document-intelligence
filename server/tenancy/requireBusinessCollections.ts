import type { Collection } from 'mongodb';
import { getTenantCollections, type TenantCollections } from './getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type {
  MongoDocumentAccessRule,
  MongoDocumentCategory,
  MongoDocumentGroup,
} from '../db/types.js';

export type BusinessAdminCollections = TenantCollections & {
  documentCategories: Collection<MongoDocumentCategory>;
  documentGroups: Collection<MongoDocumentGroup>;
  documentRules: Collection<MongoDocumentAccessRule>;
};

export async function requireBusinessAdminCollections(
  tenantId: string,
): Promise<BusinessAdminCollections> {
  const collections = await getTenantCollections(tenantId);

  if (
    !collections.documentCategories ||
    !collections.documentGroups ||
    !collections.documentRules
  ) {
    throw new ServiceError(
      'Recursos administrativos indisponíveis para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }

  return collections as BusinessAdminCollections;
}
