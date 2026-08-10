import { COLLECTIONS, REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { MongoTenant, TenantIsolationStrategy } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { isUnsafeCollectionPrefix } from './collectionGuard.js';
import { getCachedTenant, setCachedTenant } from './tenantRegistryCache.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX, LEGACY_INDIVIDUAL_POOL_PREFIX } from './taxId.js';

export type TenantCollectionBaseKey =
  | 'documents'
  | 'documentVersions'
  | 'documentChunks'
  | 'processingJobs'
  | 'auditLogs'
  | 'accessGroups'
  | 'documentClasses'
  | 'documentCategories'
  | 'documentGroups'
  | 'documentGroupMembers'
  | 'documentRules'
  | 'documentExtractionRules';

const BASE_COLLECTION_NAMES: Record<TenantCollectionBaseKey, string> = {
  documents: COLLECTIONS.documents,
  documentVersions: COLLECTIONS.documentVersions,
  documentChunks: COLLECTIONS.documentChunks,
  processingJobs: COLLECTIONS.processingJobs,
  auditLogs: COLLECTIONS.auditLogs,
  accessGroups: COLLECTIONS.accessGroups,
  documentClasses: COLLECTIONS.documentClasses,
  documentCategories: COLLECTIONS.documentCategories,
  documentGroups: COLLECTIONS.documentGroups,
  documentGroupMembers: COLLECTIONS.documentGroupMembers,
  documentRules: COLLECTIONS.documentRules,
  documentExtractionRules: COLLECTIONS.documentExtractionRules,
};

export type ResolvedTenantCollectionNames = {
  documents: string;
  documentVersions: string;
  documentChunks: string;
  processingJobs: string;
  auditLogs: string;
  accessGroups?: string;
  /** @deprecated legado */
  documentClasses?: string;
  documentCategories?: string;
  documentGroups?: string;
  documentGroupMembers?: string;
  documentRules?: string;
  documentExtractionRules?: string;
};

export function resolveTenantCollectionPrefix(tenant: MongoTenant): string {
  if (
    tenant.tenantType === 'individual' &&
    tenant.isolation.strategy === 'shared_individual_pool'
  ) {
    const configured = tenant.isolation.collectionPrefix?.trim();
    if (configured === LEGACY_INDIVIDUAL_POOL_PREFIX || !configured) {
      return SHARED_INDIVIDUAL_COLLECTION_PREFIX;
    }
    return configured;
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

/**
 * Todos os tenants compartilham o mesmo conjunto de coleções desde o Passo 7 do plano de escala:
 * o isolamento vem do `tenantId` gravado em cada documento e presente no primeiro campo de todo
 * índice, não do nome da coleção. Provisionar tenant novo deixou de criar namespace no Atlas.
 *
 * Não recebe o tenant porque o resultado não depende dele. Se um dia o plano enterprise voltar a
 * ter coleção dedicada para poucos clientes, o parâmetro volta junto.
 */
export function resolveSharedCollections(): ResolvedTenantCollectionNames {
  return {
    documents: BASE_COLLECTION_NAMES.documents,
    documentVersions: BASE_COLLECTION_NAMES.documentVersions,
    documentChunks: BASE_COLLECTION_NAMES.documentChunks,
    processingJobs: BASE_COLLECTION_NAMES.processingJobs,
    auditLogs: BASE_COLLECTION_NAMES.auditLogs,
    documentCategories: BASE_COLLECTION_NAMES.documentCategories,
    documentGroups: BASE_COLLECTION_NAMES.documentGroups,
    documentGroupMembers: BASE_COLLECTION_NAMES.documentGroupMembers,
    documentRules: BASE_COLLECTION_NAMES.documentRules,
    documentExtractionRules: BASE_COLLECTION_NAMES.documentExtractionRules,
  };
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
  const cached = await getCachedTenant(tenantId);
  if (cached) return cached;

  const db = await getDb();
  const tenant = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    $or: [{ tenantId }, { companyId: tenantId }],
  } as Record<string, unknown>);

  if (!tenant) {
    throw new ServiceError('Cliente não encontrado.', 'TENANT_NOT_FOUND', 404);
  }

  await setCachedTenant(tenantId, tenant);

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
