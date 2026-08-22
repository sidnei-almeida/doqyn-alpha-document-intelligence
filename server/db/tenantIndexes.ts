import type { IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb } from '../db/mongoClient.js';
import {
  resolveSharedCollections,
  type ResolvedTenantCollectionNames,
} from '../tenancy/tenantResolver.js';

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

    const options: {
      unique?: boolean;
      partialFilterExpression?: Record<string, unknown>;
      name?: string;
    } = {};
    if (spec.unique) options.unique = true;
    if (spec.partialFilterExpression)
      options.partialFilterExpression = spec.partialFilterExpression;
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

  if (names.documentCategories) {
    out.push({
      collection: names.documentCategories,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
      ],
    });
  }

  if (names.documentGroups) {
    out.push({
      collection: names.documentGroups,
      indexes: [
        { key: { tenantId: 1, active: 1 } },
        { key: { tenantId: 1, slug: 1 }, unique: true },
      ],
    });
  }

  if (names.documentGroupMembers) {
    out.push({
      collection: names.documentGroupMembers,
      indexes: [
        { key: { tenantId: 1, groupId: 1, active: 1 } },
        { key: { tenantId: 1, membershipId: 1, active: 1 } },
        { key: { tenantId: 1, groupId: 1, membershipId: 1 }, unique: true },
      ],
    });
  }

  if (names.documentRules) {
    out.push({
      collection: names.documentRules,
      indexes: [
        { key: { tenantId: 1, groupId: 1, categoryId: 1 }, unique: true },
        { key: { tenantId: 1, active: 1 } },
      ],
    });
  }

  if (names.documentExtractionRules) {
    out.push({
      collection: names.documentExtractionRules,
      indexes: [
        { key: { tenantId: 1, categoryId: 1, active: 1 } },
        { key: { tenantId: 1, categoryId: 1, version: -1 } },
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
        { key: { tenantId: 1, 'searchMeta.people.nameNormalized': 1 } },
        { key: { tenantId: 1, 'searchMeta.validityDate': 1 } },
        { key: { tenantId: 1, 'searchMeta.dates.kind': 1, 'searchMeta.dates.date': 1 } },
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
      collection: names.documentChunks,
      indexes: [
        { key: { tenantId: 1, documentId: 1, versionId: 1, chunkIndex: 1 }, unique: true },
        { key: { tenantId: 1, documentId: 1, isCurrentVersion: 1, chunkIndex: 1 } },
        { key: { tenantId: 1, documentId: 1, versionLabel: 1 } },
        { key: { tenantId: 1, ownerUserId: 1, documentId: 1, isCurrentVersion: 1 } },
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
        { key: { tenantId: 1, documentId: 1, occurredAt: -1 } },
        { key: { tenantId: 1, action: 1, createdAt: -1 } },
        { key: { tenantId: 1, 'actor.userId': 1, createdAt: -1 } },
        // Escopo de pessoa física: um tenant PF tem um único usuário e as consultas dele
        // filtram por tenantId + ownerUserId.
        { key: { tenantId: 1, ownerUserId: 1, createdAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
        { key: { tenantId: 1, requestId: 1 } },
        { key: { tenantId: 1, 'metadata.status': 1, createdAt: -1 } },
        { key: { tenantId: 1, 'metadata.actionGroup': 1, createdAt: -1 } },
        // A verificação da cadeia de integridade percorre o tenant inteiro em ordem de posição;
        // sem este índice ela vira collection scan com sort em memória.
        { key: { tenantId: 1, 'chain.seq': 1 } },
      ],
    },
  );

  return out;
}

/**
 * Antes existia um segundo conjunto de índices liderado por `ownerTenantId`, para o pool de pessoa
 * física. Ele foi removido no Passo 7: `applyDocumentOwnershipOnInsert` grava `ownerTenantId` com
 * o mesmo valor de `tenantId` nos dois tipos de tenant, então, agora que PF e PJ dividem as mesmas
 * coleções, aqueles índices seriam duplicatas exatas — o dobro de namespaces para nada, justo o
 * custo que este passo existe para cortar. As consultas de PF passaram a liderar por `tenantId`
 * (ver `buildDocumentOwnershipFilter`) e usam os índices abaixo.
 */
export async function ensureSharedCollectionIndexes(): Promise<IndexEnsureResult[]> {
  return ensureTenantDataIndexes(resolveSharedCollections());
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

export async function ensureRegistryTenantIndexes(): Promise<void> {
  await ensureIndexesForCollection(REGISTRY_COLLECTIONS.tenants, [
    { key: { tenantId: 1 }, unique: true },
    {
      key: { taxIdHash: 1 },
      unique: true,
      partialFilterExpression: { taxIdHash: { $exists: true } },
    },
    { key: { slug: 1 }, unique: true },
    { key: { status: 1 } },
    // resolveTenant() busca com { $or: [{ tenantId }, { companyId }] } em quase toda
    // requisição. Um $or só usa índice se TODOS os ramos forem indexados — sem este,
    // o ramo companyId força COLLSCAN no registry a cada request. Parcial porque nem
    // todo tenant tem companyId (não é único: tenantId e companyId podem coincidir).
    { key: { companyId: 1 }, partialFilterExpression: { companyId: { $exists: true } } },
  ]);
}
