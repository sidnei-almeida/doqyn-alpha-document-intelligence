import type { IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import type { MongoTenant } from '../db/types.js';
import { getDb } from '../db/mongoClient.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../tenancy/taxId.js';
import { resolveTenantCollectionNames, type ResolvedTenantCollectionNames } from '../tenancy/tenantResolver.js';
import { resolveTenantStorageContextFromIds } from '../tenancy/tenantStorage.js';

export type IndexEnsureResult = {
  collection: string;
  name: string;
  status: 'created' | 'existing';
};

async function ensureCollectionExists(collectionName: string): Promise<boolean> {
  const db = await getDb();
  const exists = await db.listCollections({ name: collectionName }).hasNext();
  if (!exists) {
    await db.createCollection(collectionName);
    return true;
  }
  return false;
}

export async function ensureIndexesForCollection(
  collectionName: string,
  indexes: IndexDescription[],
): Promise<IndexEnsureResult[]> {
  const createdCollection = await ensureCollectionExists(collectionName);
  const db = await getDb();
  const collection = db.collection(collectionName);
  const existing = await collection.indexes();
  const results: IndexEnsureResult[] = [];

  if (createdCollection) {
    results.push({ collection: collectionName, name: '_collection_', status: 'created' });
  }

  for (const spec of indexes) {
    const keyStr = JSON.stringify(spec.key);
    const match = existing.find((idx) => JSON.stringify(idx.key) === keyStr);

    if (match) {
      results.push({
        collection: collectionName,
        name: match.name ?? keyStr,
        status: 'existing',
      });
      continue;
    }

    const options: { unique?: boolean; partialFilterExpression?: Record<string, unknown>; name?: string } =
      {};
    if (spec.unique) options.unique = true;
    if (spec.partialFilterExpression) options.partialFilterExpression = spec.partialFilterExpression;
    if (spec.name) options.name = spec.name;

    const created = await collection.createIndex(spec.key, options);
    results.push({ collection: collectionName, name: created, status: 'created' });
  }

  return results;
}

function tenantScopedIndexSpecs(names: ResolvedTenantCollectionNames): Array<{
  collection: string;
  indexes: IndexDescription[];
}> {
  const out: Array<{ collection: string; indexes: IndexDescription[] }> = [];

  if (names.accessGroups) {
    out.push({
      collection: names.accessGroups,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
        { key: { tenantId: 1, status: 1 } },
      ],
    });
  }

  if (names.documentClasses) {
    out.push({
      collection: names.documentClasses,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
      ],
    });
  }

  if (names.documentRules) {
    out.push({
      collection: names.documentRules,
      indexes: [
        { key: { tenantId: 1, classId: 1, active: 1 } },
        { key: { tenantId: 1, classId: 1, version: -1 } },
      ],
    });
  }

  out.push(
    {
      collection: names.documents,
      indexes: [
        { key: { tenantId: 1, status: 1, updatedAt: -1 } },
        { key: { tenantId: 1, classId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, ownerUserId: 1, updatedAt: -1 } },
      ],
    },
    {
      collection: names.documentVersions,
      indexes: [
        { key: { tenantId: 1, documentId: 1, versionNumber: -1 }, unique: true },
        { key: { tenantId: 1, 'file.sha256': 1 } },
      ],
    },
    {
      collection: names.processingJobs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, status: 1 } },
      ],
    },
    {
      collection: names.auditLogs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, action: 1, createdAt: -1 } },
      ],
    },
  );

  return out;
}

export function sharedIndividualIndexSpecs(): Array<{
  collection: string;
  indexes: IndexDescription[];
}> {
  const ctx = resolveTenantStorageContextFromIds({
    tenantId: 'individual_placeholder',
    tenantType: 'individual',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
  });
  const names = ctx.collections;

  return [
    {
      collection: names.documents,
      indexes: [
        { key: { ownerTenantId: 1, ownerUserId: 1, createdAt: -1 } },
        { key: { ownerTenantId: 1, classId: 1, createdAt: -1 } },
        { key: { ownerTenantId: 1, status: 1, createdAt: -1 } },
        { key: { tenantType: 1, ownerTenantId: 1 } },
      ],
    },
    {
      collection: names.documentVersions,
      indexes: [
        { key: { ownerTenantId: 1, documentId: 1, versionNumber: -1 } },
        { key: { ownerTenantId: 1, createdAt: -1 } },
      ],
    },
    {
      collection: names.documentClasses!,
      indexes: [
        { key: { ownerTenantId: 1, active: 1 } },
        { key: { scope: 1, status: 1 } },
      ],
    },
    {
      collection: names.documentRules!,
      indexes: [
        { key: { ownerTenantId: 1, active: 1 } },
        { key: { scope: 1, status: 1 } },
      ],
    },
    {
      collection: names.processingJobs,
      indexes: [{ key: { ownerTenantId: 1, status: 1, createdAt: -1 } }],
    },
    {
      collection: names.auditLogs,
      indexes: [
        { key: { ownerTenantId: 1, createdAt: -1 } },
        { key: { ownerUserId: 1, createdAt: -1 } },
        { key: { action: 1, createdAt: -1 } },
      ],
    },
  ];
}

export async function ensureSharedIndividualIndexes(): Promise<IndexEnsureResult[]> {
  const all: IndexEnsureResult[] = [];
  for (const group of sharedIndividualIndexSpecs()) {
    const results = await ensureIndexesForCollection(group.collection, group.indexes);
    all.push(...results);
  }
  return all;
}

export async function ensureTenantDataIndexes(
  names: ResolvedTenantCollectionNames,
): Promise<IndexEnsureResult[]> {
  const all: IndexEnsureResult[] = [];
  for (const group of tenantScopedIndexSpecs(names)) {
    const results = await ensureIndexesForCollection(group.collection, group.indexes);
    all.push(...results);
  }
  return all;
}

export function listTenantCollectionNames(tenant: MongoTenant): string[] {
  const names = resolveTenantCollectionNames(tenant);
  return Object.values(names).filter((name): name is string => Boolean(name));
}

export async function ensureRegistryTenantIndexes(): Promise<void> {
  await ensureIndexesForCollection(REGISTRY_COLLECTIONS.tenants, [
    { key: { tenantId: 1 }, unique: true },
    { key: { taxIdHash: 1 }, unique: true, partialFilterExpression: { taxIdHash: { $exists: true } } },
    { key: { slug: 1 }, unique: true },
    { key: { status: 1 } },
  ]);
}
