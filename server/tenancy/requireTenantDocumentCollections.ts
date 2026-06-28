import type { Collection } from 'mongodb';
import { getTenantCollections, type TenantCollections } from './getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type TenantGovernanceCollections = TenantCollections & {
  documentCategories: Collection;
  documentGroups: Collection;
  documentGroupMembers: Collection;
  documentRules: Collection;
  documentExtractionRules: Collection;
};

export async function requireTenantGovernanceCollections(
  tenantId: string,
  opts?: { userId?: string; membershipId?: string },
): Promise<TenantGovernanceCollections> {
  const collections = await getTenantCollections(tenantId, opts);

  if (
    !collections.documentCategories ||
    !collections.documentGroups ||
    !collections.documentGroupMembers ||
    !collections.documentRules ||
    !collections.documentExtractionRules
  ) {
    throw new ServiceError(
      'Governança documental indisponível para este tipo de cliente.',
      'TENANT_COLLECTION_UNAVAILABLE',
      400,
    );
  }

  return collections as TenantGovernanceCollections;
}

/** @deprecated Prefer requireTenantGovernanceCollections */
export async function requireTenantDocumentCollections(
  tenantId: string,
  opts?: { userId?: string; membershipId?: string },
): Promise<TenantGovernanceCollections> {
  return requireTenantGovernanceCollections(tenantId, opts);
}
