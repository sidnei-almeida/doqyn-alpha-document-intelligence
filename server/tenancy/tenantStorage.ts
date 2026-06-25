import { COLLECTIONS } from '../db/constants.js';
import type { MongoTenant, TenantType } from '../db/types.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type { ResolvedTenantCollectionNames } from './tenantResolver.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from './taxId.js';

export type TenantStorageMode = 'dedicated_collections' | 'shared_individual_collection';

export type TenantStorageContext = {
  tenantId: string;
  tenantType: TenantType;
  storageMode: TenantStorageMode;
  collectionPrefix: string;
  userId?: string;
  membershipId?: string;
  collections: ResolvedTenantCollectionNames;
};

function resolvePrefixedName(base: string, prefix: string): string {
  return `${base}_${prefix}`;
}

function resolveBusinessCollections(prefix: string): ResolvedTenantCollectionNames {
  return {
    documents: resolvePrefixedName(COLLECTIONS.documents, prefix),
    documentVersions: resolvePrefixedName(COLLECTIONS.documentVersions, prefix),
    processingJobs: resolvePrefixedName(COLLECTIONS.processingJobs, prefix),
    auditLogs: resolvePrefixedName(COLLECTIONS.auditLogs, prefix),
    accessGroups: resolvePrefixedName(COLLECTIONS.accessGroups, prefix),
    documentClasses: resolvePrefixedName(COLLECTIONS.documentClasses, prefix),
    documentRules: resolvePrefixedName(COLLECTIONS.documentRules, prefix),
  };
}

function resolveSharedIndividualCollections(): ResolvedTenantCollectionNames {
  const prefix = SHARED_INDIVIDUAL_COLLECTION_PREFIX;
  return {
    documents: resolvePrefixedName(COLLECTIONS.documents, prefix),
    documentVersions: resolvePrefixedName(COLLECTIONS.documentVersions, prefix),
    processingJobs: resolvePrefixedName(COLLECTIONS.processingJobs, prefix),
    auditLogs: resolvePrefixedName(COLLECTIONS.auditLogs, prefix),
    documentClasses: resolvePrefixedName(COLLECTIONS.documentClasses, prefix),
    documentRules: resolvePrefixedName(COLLECTIONS.documentRules, prefix),
  };
}

export function resolveTenantStorageContext(input: {
  tenant: MongoTenant;
  userId?: string;
  membershipId?: string;
}): TenantStorageContext {
  const { tenant } = input;

  if (tenant.tenantType === 'business') {
    const collectionPrefix = tenant.isolation.collectionPrefix?.trim() || tenant.tenantId;
    return {
      tenantId: tenant.tenantId,
      tenantType: 'business',
      storageMode: 'dedicated_collections',
      collectionPrefix,
      userId: input.userId,
      membershipId: input.membershipId,
      collections: resolveBusinessCollections(collectionPrefix),
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
      collections: resolveSharedIndividualCollections(),
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
    const collectionPrefix = input.collectionPrefix?.trim() || input.tenantId;
    return {
      tenantId: input.tenantId,
      tenantType: 'business',
      storageMode: 'dedicated_collections',
      collectionPrefix,
      userId: input.userId,
      membershipId: input.membershipId,
      collections: resolveBusinessCollections(collectionPrefix),
    };
  }

  return {
    tenantId: input.tenantId,
    tenantType: 'individual',
    storageMode: 'shared_individual_collection',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    userId: input.userId,
    membershipId: input.membershipId,
    collections: resolveSharedIndividualCollections(),
  };
}

export function assertStorageModeAccess(
  context: TenantStorageContext,
  expected: TenantStorageMode,
): void {
  if (context.storageMode !== expected) {
    throw new ServiceError('Operação não permitida para este tipo de tenant.', 'STORAGE_MODE_MISMATCH', 403);
  }
}
