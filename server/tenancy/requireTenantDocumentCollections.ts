import type { Collection } from 'mongodb';
import { getTenantCollections, type TenantCollections } from './getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TenantDocumentAdminCollections = TenantCollections & {
  documentClasses: Collection;
  documentRules: Collection;
};

export async function requireTenantDocumentCollections(
  tenantId: string,
  opts?: { userId?: string; membershipId?: string },
): Promise<TenantDocumentAdminCollections> {
  const collections = await getTenantCollections(tenantId, opts);

  if (!collections.documentClasses || !collections.documentRules) {
    throw new ServiceError(
      'Classes e regras documentais indisponíveis para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }

  return collections as TenantDocumentAdminCollections;
}
