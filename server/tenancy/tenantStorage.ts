import type { MongoTenant, TenantType } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { resolveSharedCollections, type ResolvedTenantCollectionNames } from './tenantResolver.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from './taxId.js';

// Reexportado daqui porque a maior parte do código já importa nomes de coleção via tenantStorage.
export { resolveSharedCollections };

/**
 * Como as consultas do tenant são filtradas. **Não** define mais quais coleções ele usa: desde o
 * Passo 7 todos os tenants compartilham o mesmo conjunto (ver `resolveSharedCollections`).
 *
 * - `shared_collections` — empresarial: escopo por `tenantId`.
 * - `shared_individual_collection` — pessoa física: escopo por `ownerTenantId` + `ownerUserId`,
 *   isolamento mais estreito porque um tenant PF tem um único usuário.
 */
export type TenantStorageMode = 'shared_collections' | 'shared_individual_collection';

export type TenantStorageContext = {
  tenantId: string;
  tenantType: TenantType;
  storageMode: TenantStorageMode;
  collectionPrefix: string;
  userId?: string;
  membershipId?: string;
  collections: ResolvedTenantCollectionNames;
};

export function resolveTenantStorageContext(input: {
  tenant: MongoTenant;
  userId?: string;
  membershipId?: string;
}): TenantStorageContext {
  const { tenant } = input;

  if (tenant.tenantType === 'business') {
    return {
      tenantId: tenant.tenantId,
      tenantType: 'business',
      storageMode: 'shared_collections',
      collectionPrefix: tenant.isolation.collectionPrefix?.trim() || tenant.tenantId,
      userId: input.userId,
      membershipId: input.membershipId,
      collections: resolveSharedCollections(),
    };
  }

  if (tenant.tenantType === 'individual') {
    return {
      tenantId: tenant.tenantId,
      tenantType: 'individual',
      storageMode: 'shared_individual_collection',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
      userId: input.userId,
      membershipId: input.membershipId,
      collections: resolveSharedCollections(),
    };
  }

  throw new ServiceError('Tipo de tenant não suportado.', 'TENANT_TYPE_UNSUPPORTED', 400);
}

export function resolveTenantStorageContextFromIds(input: {
  tenantId: string;
  tenantType: TenantType;
  collectionPrefix?: string;
  userId?: string;
  membershipId?: string;
}): TenantStorageContext {
  if (input.tenantType === 'business') {
    return {
      tenantId: input.tenantId,
      tenantType: 'business',
      storageMode: 'shared_collections',
      collectionPrefix: input.collectionPrefix?.trim() || input.tenantId,
      userId: input.userId,
      membershipId: input.membershipId,
      collections: resolveSharedCollections(),
    };
  }

  return {
    tenantId: input.tenantId,
    tenantType: 'individual',
    storageMode: 'shared_individual_collection',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    userId: input.userId,
    membershipId: input.membershipId,
    collections: resolveSharedCollections(),
  };
}

export function assertStorageModeAccess(
  context: TenantStorageContext,
  expected: TenantStorageMode,
): void {
  if (context.storageMode !== expected) {
    throw new ServiceError(
      'Operação não permitida para este tipo de tenant.',
      'STORAGE_MODE_MISMATCH',
      403,
    );
  }
}
