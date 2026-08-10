import 'dotenv/config';
import { join } from 'node:path';
import type { IndexDescription } from 'mongodb';
import { REGISTRY_COLLECTIONS, SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import type { ResolvedTenantCollectionNames } from '../server/tenancy/tenantResolver.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_INDICES_MONGODB.txt');

type IndexResult = { collection: string; name: string; status: 'created' | 'existing' | 'error'; error?: string };

const results: IndexResult[] = [];

async function ensureCollectionExists(collectionName: string) {
  const db = await getDb();
  const exists = await db.listCollections({ name: collectionName }).hasNext();
  if (!exists) {
    await db.createCollection(collectionName);
  }
}

async function ensureIndexes(collectionName: string, indexes: IndexDescription[]) {
  await ensureCollectionExists(collectionName);
  const db = await getDb();
  const collection = db.collection(collectionName);
  const existing = await collection.indexes();

  for (const spec of indexes) {
    const keyStr = JSON.stringify(spec.key);
    const already = existing.some((idx) => JSON.stringify(idx.key) === keyStr);

    if (already) {
      const name = existing.find((idx) => JSON.stringify(idx.key) === keyStr)?.name ?? keyStr;
      results.push({ collection: collectionName, name, status: 'existing' });
      continue;
    }

    try {
      const options: { unique?: boolean; partialFilterExpression?: Record<string, unknown>; name?: string } = {};
      if (spec.unique) options.unique = true;
      if (spec.partialFilterExpression) options.partialFilterExpression = spec.partialFilterExpression;
      if (spec.name) options.name = spec.name;

      const created = await collection.createIndex(spec.key, options);
      results.push({ collection: collectionName, name: created, status: 'created' });
    } catch (error) {
      results.push({
        collection: collectionName,
        name: keyStr,
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

function registryIndexes(): Array<{ collection: string; indexes: IndexDescription[] }> {
  return [
    {
      collection: REGISTRY_COLLECTIONS.tenants,
      indexes: [
        { key: { tenantId: 1 }, unique: true },
        // Parcial: sem isso, o segundo tenant sem taxIdHash quebra com duplicate-key
        // (Mongo trata campo ausente como null e único só aceita um null).
        // Espelha server/db/tenantIndexes.ts:ensureRegistryTenantIndexes.
        { key: { taxIdHash: 1 }, unique: true, partialFilterExpression: { taxIdHash: { $exists: true } } },
        { key: { slug: 1 }, unique: true },
        { key: { status: 1 } },
        // resolveTenant() faz { $or: [{ tenantId }, { companyId }] } em quase toda
        // requisição, e $or só usa índice se todos os ramos forem indexados.
        { key: { companyId: 1 }, partialFilterExpression: { companyId: { $exists: true } } },
        { key: { tenantType: 1, status: 1 } },
        { key: { createdAt: 1 } },
        { key: { updatedAt: 1 } },
      ],
    },
    {
      collection: REGISTRY_COLLECTIONS.tenantMembers,
      indexes: [
        { key: { tenantId: 1, status: 1 } },
        {
          key: { tenantId: 1, emailNormalized: 1 },
          unique: true,
          partialFilterExpression: { status: { $in: ['active', 'pending'] } },
        },
        { key: { tenantId: 1, authUserId: 1 } },
        { key: { authUserId: 1, status: 1 } },
        { key: { tenantId: 1, accessGroupIds: 1 } },
        { key: { tenantId: 1, createdAt: 1 } },
        { key: { tenantId: 1, updatedAt: 1 } },
        { key: { memberId: 1 }, unique: true },
      ],
    },
  ];
}

function sharedAppIndexes(): Array<{ collection: string; indexes: IndexDescription[] }> {
  return [
    {
      collection: SHARED_APP_COLLECTIONS.analysisJobs,
      indexes: [
        { key: { tenantId: 1, ownerUserId: 1, createdAt: -1 } },
        { key: { tenantId: 1, status: 1, createdAt: -1 } },
        { key: { status: 1, createdAt: -1 } },
      ],
    },
  ];
}

function tenantScopedIndexes(names: ResolvedTenantCollectionNames): Array<{
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
        { key: { tenantId: 1, currentVersionId: 1 } },
        { key: { 'access.viewGroupIds': 1, tenantId: 1, updatedAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
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
        { key: { 'classification.classId': 1, tenantId: 1 } },
        { key: { tenantId: 1, createdAt: -1 } },
      ],
    },
    {
      collection: names.processingJobs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, status: 1 } },
        { key: { tenantId: 1, updatedAt: 1 } },
        { key: { tenantId: 1, versionId: 1 } },
      ],
    },
    {
      collection: names.auditLogs,
      indexes: [
        { key: { tenantId: 1, documentId: 1, createdAt: -1 } },
        { key: { tenantId: 1, action: 1, createdAt: -1 } },
        { key: { 'actor.userId': 1, tenantId: 1, createdAt: -1 } },
        { key: { tenantId: 1, createdAt: -1 } },
      ],
    },
  );

  return out;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const db = await getDb();
  const database = getMongoDatabaseName();

  for (const group of registryIndexes()) {
    await ensureIndexes(group.collection, group.indexes);
  }

  for (const group of sharedAppIndexes()) {
    await ensureIndexes(group.collection, group.indexes);
  }

  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  // Conjunto compartilhado: garantido uma única vez. Antes o laço rodava por tenant ativo,
  // porque cada um tinha suas próprias coleções; hoje todos resolvem para as mesmas, então
  // repetir por tenant só refaria o mesmo trabalho N vezes.
  for (const group of tenantScopedIndexes(resolveSharedCollections())) {
    await ensureIndexes(group.collection, group.indexes);
  }

  const report = createReportWriter();
  report.line('DOQYN — Relatório de índices MongoDB');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${database}`);
  report.line('Relatório sanitizado.');

  report.section('RESUMO');
  const created = results.filter((r) => r.status === 'created').length;
  const existing = results.filter((r) => r.status === 'existing').length;
  const errors = results.filter((r) => r.status === 'error').length;
  report.line(`Índices criados: ${created}`);
  report.line(`Índices já existentes: ${existing}`);
  report.line(`Erros: ${errors}`);
  report.line(`Tenants ativos processados: ${tenants.length}`);

  report.section('DETALHES');
  for (const r of results) {
    report.line(`${r.collection} | ${r.name} | ${r.status}${r.error ? ` | ${r.error}` : ''}`);
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`Database: ${database} | Criados: ${created} | Existentes: ${existing} | Erros: ${errors}`);

  await closeMongoConnection();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
