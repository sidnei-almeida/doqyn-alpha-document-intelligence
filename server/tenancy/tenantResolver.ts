import { COLLECTIONS, REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { MongoTenant, TenantIsolationStrategy } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { isUnsafeCollectionPrefix } from './collectionGuard.js';
import { buildIndividualPoolPrefix } from './taxId.js';

export type TenantCollectionBaseKey =
  | 'documents'
  | 'documentVersions'
  | 'processingJobs'
  | 'auditLogs'
  | 'accessGroups'
  | 'documentClasses'
  | 'documentRules';

const BASE_COLLECTION_NAMES: Record<TenantCollectionBaseKey, string> = {
  documents: COLLECTIONS.documents,
  documentVersions: COLLECTIONS.documentVersions,
  processingJobs: COLLECTIONS.processingJobs,
  auditLogs: COLLECTIONS.auditLogs,
  accessGroups: COLLECTIONS.accessGroups,
  documentClasses: COLLECTIONS.documentClasses,
  documentRules: COLLECTIONS.documentRules,
};

export type ResolvedTenantCollectionNames = {
  documents: string;
  documentVersions: string;
  processingJobs: string;
  auditLogs: string;
  accessGroups?: string;
  documentClasses?: string;
  documentRules?: string;
};

function resolvePrefixedName(base: string, prefix: string): string {
  return `${base}_${prefix}`;
}

export function resolveTenantCollectionPrefix(tenant: MongoTenant): string {
  if (tenant.tenantType === 'individual' && tenant.isolation.strategy === 'shared_individual_pool') {
    const configured = tenant.isolation.collectionPrefix?.trim();
    return configured || buildIndividualPoolPrefix();
  }

  const prefix = tenant.isolation.collectionPrefix.trim();
  if (!prefix) {
    throw new ServiceError('Tenant sem collectionPrefix configurado.', 'TENANT_MISCONFIGURED', 500);
  }

  if (isUnsafeCollectionPrefix(prefix)) {
    throw new ServiceError(
      'collectionPrefix não pode ser CPF/CNPJ cru. Use identificador interno seguro.',
      'UNSAFE_COLLECTION_PREFIX',
      500,
    );
  }

  return prefix;
}

export function resolveTenantCollectionNames(tenant: MongoTenant): ResolvedTenantCollectionNames {
  const prefix = resolveTenantCollectionPrefix(tenant);

  const core: ResolvedTenantCollectionNames = {
    documents: resolvePrefixedName(BASE_COLLECTION_NAMES.documents, prefix),
    documentVersions: resolvePrefixedName(BASE_COLLECTION_NAMES.documentVersions, prefix),
    processingJobs: resolvePrefixedName(BASE_COLLECTION_NAMES.processingJobs, prefix),
    auditLogs: resolvePrefixedName(BASE_COLLECTION_NAMES.auditLogs, prefix),
  };

  if (tenant.tenantType === 'business') {
    return {
      ...core,
      accessGroups: resolvePrefixedName(BASE_COLLECTION_NAMES.accessGroups, prefix),
      documentClasses: resolvePrefixedName(BASE_COLLECTION_NAMES.documentClasses, prefix),
      documentRules: resolvePrefixedName(BASE_COLLECTION_NAMES.documentRules, prefix),
    };
  }

  return core;
}

export function assertTenantIsolationStrategy(
  tenant: MongoTenant,
  strategy: TenantIsolationStrategy,
): void {
  if (tenant.isolation.strategy !== strategy) {
    throw new ServiceError(
      'Estratégia de isolamento incompatível com o tipo de tenant.',
      'TENANT_ISOLATION_MISMATCH',
      400,
    );
  }
}

export async function resolveTenant(tenantId: string): Promise<MongoTenant> {
  const db = await getDb();
  const tenant = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    $or: [{ tenantId }, { companyId: tenantId }],
  } as Record<string, unknown>);

  if (!tenant) {
    throw new ServiceError('Cliente não encontrado.', 'TENANT_NOT_FOUND', 404);
  }

  return tenant;
}

export async function resolveActiveTenant(tenantId: string): Promise<MongoTenant> {
  const tenant = await resolveTenant(tenantId);

  if (tenant.status !== 'active') {
    throw new ServiceError('Cliente inativo ou indisponível.', 'TENANT_INACTIVE', 403);
  }

  if (tenant.tenantType === 'individual' && tenant.taxIdType !== 'CPF') {
    throw new ServiceError('Tenant individual deve usar CPF.', 'TENANT_TYPE_MISMATCH', 400);
  }

  if (tenant.tenantType === 'business' && tenant.taxIdType !== 'CNPJ') {
    throw new ServiceError('Tenant business deve usar CNPJ.', 'TENANT_TYPE_MISMATCH', 400);
  }

  if (tenant.tenantType === 'individual') {
    assertTenantIsolationStrategy(tenant, 'shared_individual_pool');
  }

  if (tenant.tenantType === 'business') {
    assertTenantIsolationStrategy(tenant, 'collection_prefix');
  }

  return tenant;
}
