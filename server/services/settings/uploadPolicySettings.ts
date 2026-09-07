import {
  DEFAULT_TENANT_UPLOAD_POLICY,
  normalizeTenantUploadPolicy,
  type TenantUploadPolicy,
} from '../../../shared/uploadPolicy.js';
import { REGISTRY_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoTenant } from '../../db/types.js';
import { invalidateTenantRegistryCache } from '../../tenancy/tenantRegistryCache.js';
import { ServiceError } from '../../utils/serviceErrors.js';

export async function getTenantUploadPolicy(tenantId: string): Promise<TenantUploadPolicy> {
  if (!isMongoNativeConfigured()) {
    return { ...DEFAULT_TENANT_UPLOAD_POLICY };
  }

  const db = await getDb();
  const tenant = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .findOne({ tenantId }, { projection: { 'settings.uploadPolicy': 1 } });

  return normalizeTenantUploadPolicy(tenant?.settings?.uploadPolicy);
}

export async function updateTenantUploadPolicy(
  tenantId: string,
  patch: Partial<TenantUploadPolicy>,
): Promise<TenantUploadPolicy> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const current = await getTenantUploadPolicy(tenantId);
  const next = normalizeTenantUploadPolicy({ ...current, ...patch });

  const db = await getDb();
  const result = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).updateOne(
    { tenantId },
    {
      $set: {
        'settings.uploadPolicy': next,
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new ServiceError('Tenant não encontrado.', 'TENANT_NOT_FOUND', 404);
  }

  await invalidateTenantRegistryCache(tenantId);

  return next;
}
