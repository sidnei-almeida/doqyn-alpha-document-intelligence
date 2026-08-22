import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import type { MongoTenant, MongoTenantStorage } from '../db/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { invalidateTenantRegistryCache } from '../tenancy/tenantRegistryCache.js';
import {
  buildTenantBucketName,
  isLegacyTenantBucketName,
  type BuildTenantBucketNameResult,
} from '../storage/r2/r2BucketNaming.js';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import { getR2ConfigFromEnv } from '../storage/storageConfig.js';
import {
  ensureBucketForStorageScope,
  headTenantBucket,
} from '../storage/r2/r2BucketProvisioner.js';
import { createR2AdminClient } from '../storage/r2/r2Clients.js';

export type TenantStorageConfigRecord = {
  tenantId: string;
  tenantType: TenantStorageScope['tenantType'];
  provider: 'cloudflare_r2';
  bucketMode: TenantStorageScope['bucketMode'];
  bucketName: string;
  basePrefix: string;
  keyPrefix: string;
  bucketAlias: string;
  bucketSlug?: string;
  shortHash?: string;
  provisionStatus: MongoTenantStorage['bucketStatus'];
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
    bucketAlias: scope.bucketAlias ?? scope.bucketName,
    bucketSlug: scope.bucketSlug,
    shortHash: scope.shortHash,
    provisionStatus: 'ready',
    updatedAt: new Date(),
  };
}

function storageFromTenant(tenant: MongoTenant): MongoTenantStorage | null {
  return tenant.storage?.bucketName ? tenant.storage : null;
}

export function planTenantBucketName(
  tenant: Pick<MongoTenant, 'tenantId' | 'displayName' | 'slug'>,
): BuildTenantBucketNameResult {
  return buildTenantBucketName({
    tenantId: tenant.tenantId,
    tenantDisplayName: tenant.displayName,
    tenantSlug: tenant.slug,
  });
}

export async function findLegacyBucketAliasFromDocuments(tenantId: string): Promise<string | null> {
  const { documentVersions } = await getTenantCollections(tenantId);
  const pipeline = [
    {
      $match: {
        $or: [{ tenantId }, { companyId: tenantId }],
        'storage.primary.bucketAlias': { $type: 'string', $ne: '' },
      },
    },
    {
      $group: {
        _id: '$storage.primary.bucketAlias',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ];

  const rows = await documentVersions.aggregate(pipeline).toArray();
  const bucket = rows[0]?._id;
  return typeof bucket === 'string' && bucket.trim() ? bucket.trim() : null;
}

export async function getTenantStorageFromRegistry(
  tenantId: string,
): Promise<MongoTenantStorage | null> {
  const db = await getDb();
  const tenant = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    $or: [{ tenantId }, { companyId: tenantId }],
  } as Record<string, unknown>);
  return tenant ? storageFromTenant(tenant) : null;
}

export async function upsertTenantStorageRegistry(
  tenantId: string,
  storage: MongoTenantStorage,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .updateOne({ $or: [{ tenantId }, { companyId: tenantId }] } as Record<string, unknown>, {
      $set: {
        storage,
        updatedAt: now,
      },
    });

  await invalidateTenantRegistryCache(tenantId);
}

export async function resolveTenantBucketRegistry(
  tenant: MongoTenant,
): Promise<MongoTenantStorage> {
  const existing = storageFromTenant(tenant);
  if (existing?.bucketName) {
    return existing;
  }

  const legacyFromDocs = await findLegacyBucketAliasFromDocuments(tenant.tenantId);
  if (legacyFromDocs) {
    const storage: MongoTenantStorage = {
      provider: 'cloudflare_r2',
      mode: 'per_tenant',
      bucketName: legacyFromDocs,
      bucketAlias: tenant.displayName,
      bucketStatus: 'ready',
      bucketLastCheckedAt: new Date(),
    };
    await upsertTenantStorageRegistry(tenant.tenantId, storage);
    return storage;
  }

  const planned = planTenantBucketName(tenant);
  const storage: MongoTenantStorage = {
    provider: 'cloudflare_r2',
    mode: 'per_tenant',
    bucketName: planned.bucketName,
    bucketAlias: tenant.displayName,
    bucketSlug: planned.bucketSlug,
    shortHash: planned.shortHash,
    bucketStatus: 'pending',
    bucketLastCheckedAt: new Date(),
  };
  await upsertTenantStorageRegistry(tenant.tenantId, storage);
  return storage;
}

export async function registerTenantStoragePlan(
  tenant: Pick<MongoTenant, 'tenantId' | 'displayName' | 'slug' | 'tenantType' | 'storage'>,
): Promise<MongoTenantStorage> {
  if (tenant.storage?.bucketName) {
    return tenant.storage;
  }

  if (tenant.tenantType === 'individual') {
    const r2Config = getR2ConfigFromEnv();
    const defaultBucket = r2Config?.defaultBucket?.trim() || 'doqyn-alpha';
    const storage: MongoTenantStorage = {
      provider: 'cloudflare_r2',
      mode: 'shared',
      bucketName: defaultBucket,
      bucketAlias: tenant.displayName,
      bucketStatus: 'pending',
      bucketLastCheckedAt: new Date(),
    };
    await upsertTenantStorageRegistry(tenant.tenantId, storage);
    return storage;
  }

  const planned = planTenantBucketName(tenant);
  const storage: MongoTenantStorage = {
    provider: 'cloudflare_r2',
    mode: 'per_tenant',
    bucketName: planned.bucketName,
    bucketAlias: tenant.displayName,
    bucketSlug: planned.bucketSlug,
    shortHash: planned.shortHash,
    bucketStatus: 'pending',
    bucketLastCheckedAt: new Date(),
  };
  await upsertTenantStorageRegistry(tenant.tenantId, storage);
  return storage;
}

export async function markTenantBucketReady(tenantId: string, bucketName: string): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .updateOne({ $or: [{ tenantId }, { companyId: tenantId }] } as Record<string, unknown>, {
      $set: {
        'storage.bucketName': bucketName,
        'storage.bucketStatus': 'ready',
        'storage.bucketCreatedAt': now,
        'storage.bucketLastCheckedAt': now,
        updatedAt: now,
      },
      $unset: {
        'storage.bucketProvisionError': '',
      },
    });

  await invalidateTenantRegistryCache(tenantId);
}

export async function markTenantBucketFailed(
  tenantId: string,
  errorMessage: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .updateOne({ $or: [{ tenantId }, { companyId: tenantId }] } as Record<string, unknown>, {
      $set: {
        'storage.bucketStatus': 'failed',
        'storage.bucketProvisionError': errorMessage.slice(0, 500),
        'storage.bucketLastCheckedAt': now,
        updatedAt: now,
      },
    });

  await invalidateTenantRegistryCache(tenantId);
}

export async function ensureTenantStorageBucket(
  tenant: MongoTenant,
): Promise<{ bucket: string; created: boolean }> {
  const r2Config = getR2ConfigFromEnv();
  if (!r2Config) {
    throw new Error('Configuração R2 ausente.');
  }

  const registry =
    tenant.tenantType === 'business'
      ? await resolveTenantBucketRegistry(tenant)
      : await registerTenantStoragePlan(tenant);

  const bucketMode = registry.mode;
  const bucketName = registry.bucketName;

  try {
    const result = await ensureBucketForStorageScope({
      bucketMode,
      bucketName,
      tenantId: tenant.tenantId,
      config: r2Config,
    });

    await markTenantBucketReady(tenant.tenantId, result.bucket);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao provisionar bucket.';
    await markTenantBucketFailed(tenant.tenantId, message);
    throw error;
  }
}

export function isLegacyStorageRegistry(storage: MongoTenantStorage | undefined): boolean {
  return Boolean(storage?.bucketName && isLegacyTenantBucketName(storage.bucketName));
}

export async function listAllTenantStorageRegistries(): Promise<
  Array<{ tenant: MongoTenant; storage: MongoTenantStorage | null }>
> {
  const db = await getDb();
  const tenants = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).find({}).toArray();
  return tenants.map((tenant) => ({
    tenant,
    storage: storageFromTenant(tenant),
  }));
}

export async function listReferencedBucketNames(): Promise<Set<string>> {
  const db = await getDb();
  const referenced = new Set<string>();

  const tenants = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).find({}).toArray();
  for (const tenant of tenants) {
    if (tenant.storage?.bucketName) referenced.add(tenant.storage.bucketName);
  }

  const versionCollections = await db.listCollections({ name: /^document_versions_/ }).toArray();
  for (const collInfo of versionCollections) {
    const coll = db.collection(collInfo.name);
    const aliases = await coll.distinct('storage.primary.bucketAlias');
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) referenced.add(alias.trim());
    }
    const previewAliases = await coll.distinct('storage.preview.bucketAlias');
    for (const alias of previewAliases) {
      if (typeof alias === 'string' && alias.trim()) referenced.add(alias.trim());
    }
  }

  const r2Config = getR2ConfigFromEnv();
  if (r2Config?.defaultBucket) referenced.add(r2Config.defaultBucket);

  return referenced;
}

export async function headBucketExists(bucketName: string): Promise<boolean> {
  const r2Config = getR2ConfigFromEnv();
  if (!r2Config) return false;
  const adminClient = createR2AdminClient(r2Config);
  return headTenantBucket(adminClient, bucketName);
}

export { isLegacyTenantBucketName };
