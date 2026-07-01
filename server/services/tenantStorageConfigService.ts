/**
 * TODO(tenant_storage_configs): persistir e consultar decisões de storage por tenant
 * (bucketName, basePrefix, provisionStatus) após provisionamento Mongo/signup.
 * Nesta etapa o scope é calculado em runtime via resolveTenantStorageScope.
 */
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';

export type TenantStorageConfigRecord = {
  tenantId: string;
  tenantType: TenantStorageScope['tenantType'];
  provider: 'cloudflare_r2';
  bucketMode: TenantStorageScope['bucketMode'];
  bucketName: string;
  basePrefix: string;
  keyPrefix: string;
  provisionStatus: 'pending' | 'provisioning' | 'ready' | 'failed';
  updatedAt: Date;
};

export function scopeToStorageConfigRecord(scope: TenantStorageScope): TenantStorageConfigRecord {
  return {
    tenantId: scope.tenantId,
    tenantType: scope.tenantType,
    provider: scope.provider,
    bucketMode: scope.bucketMode,
    bucketName: scope.bucketName,
    basePrefix: scope.basePrefix,
    keyPrefix: scope.keyPrefix,
    provisionStatus: 'ready',
    updatedAt: new Date(),
  };
}
