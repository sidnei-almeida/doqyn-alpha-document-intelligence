/**
 * Migração P1: renomeia `keycloakUserId` → `authUserId` em todas as collections Mongo.
 *
 * Dry-run por padrão. Para aplicar:
 *   npm run db:migrate-keycloak-to-auth-user-id -- --apply
 *   ou MIGRATION_APPLY=true
 *
 * Ordem recomendada: dev → staging → prod.
 * O script também valida que ownerUserId de documentos continua mapeável a um membro.
 */
import 'dotenv/config';
import { join } from 'node:path';
import type { Collection, Db, Document } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_MIGRACAO_KEYCLOAK_TO_AUTH_USER_ID.txt');
const LEGACY_FIELD = 'keycloakUserId';
const NEW_FIELD = 'authUserId';

type CollectionRenameStats = {
  collection: string;
  withLegacyOnly: number;
  withBoth: number;
  conflicts: number;
  renamed: number;
  unsetDuplicate: number;
  skippedConflict: number;
};

function hasApplyArg(): boolean {
  return process.argv.includes('--apply') || isApplyFlag('MIGRATION_APPLY');
}

async function listCollectionNames(db: Db): Promise<string[]> {
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  return infos.map((info) => info.name).sort();
}

async function countField(
  collection: Collection<Document>,
  filter: Record<string, unknown>,
): Promise<number> {
  return collection.countDocuments(filter);
}

async function migrateCollection(
  db: Db,
  collectionName: string,
  apply: boolean,
): Promise<CollectionRenameStats | null> {
  const collection = db.collection(collectionName);
  const withLegacy = await countField(collection, { [LEGACY_FIELD]: { $exists: true } });
  if (withLegacy === 0) return null;

  const withLegacyOnly = await countField(collection, {
    [LEGACY_FIELD]: { $exists: true },
    [NEW_FIELD]: { $exists: false },
  });
  const withBoth = await countField(collection, {
    [LEGACY_FIELD]: { $exists: true },
    [NEW_FIELD]: { $exists: true },
  });

  let conflicts = 0;
  if (withBoth > 0) {
    conflicts = await countField(collection, {
      [LEGACY_FIELD]: { $exists: true },
      [NEW_FIELD]: { $exists: true },
      $expr: { $ne: [`$${LEGACY_FIELD}`, `$${NEW_FIELD}`] },
    });
  }

  const stats: CollectionRenameStats = {
    collection: collectionName,
    withLegacyOnly,
    withBoth,
    conflicts,
    renamed: 0,
    unsetDuplicate: 0,
    skippedConflict: conflicts,
  };

  if (!apply) return stats;

  if (withLegacyOnly > 0) {
    const renameResult = await collection.updateMany(
      {
        [LEGACY_FIELD]: { $exists: true },
        [NEW_FIELD]: { $exists: false },
      },
      { $rename: { [LEGACY_FIELD]: NEW_FIELD } },
    );
    stats.renamed = renameResult.modifiedCount;
  }

  const equalBoth = await collection
    .find({
      [LEGACY_FIELD]: { $exists: true },
      [NEW_FIELD]: { $exists: true },
      $expr: { $eq: [`$${LEGACY_FIELD}`, `$${NEW_FIELD}`] },
    })
    .project({ _id: 1 })
    .toArray();

  if (equalBoth.length > 0) {
    const unsetResult = await collection.updateMany(
      {
        _id: { $in: equalBoth.map((doc) => doc._id) },
      },
      { $unset: { [LEGACY_FIELD]: '' } },
    );
    stats.unsetDuplicate = unsetResult.modifiedCount;
  }

  return stats;
}

async function dropLegacyIndexes(db: Db, collectionName: string, report: ReturnType<typeof createReportWriter>) {
  const collection = db.collection(collectionName);
  let indexes: Array<{ name?: string; key: Document }> = [];
  try {
    indexes = await collection.indexes();
  } catch {
    return;
  }

  for (const index of indexes) {
    const keys = Object.keys(index.key ?? {});
    if (!keys.includes(LEGACY_FIELD)) continue;
    if (!index.name || index.name === '_id_') continue;
    try {
      await collection.dropIndex(index.name);
      report.line(`  drop index ${collectionName}.${index.name}`);
    } catch (error) {
      report.line(
        `  falha ao dropar ${collectionName}.${index.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

async function ensureAuthUserIdIndexes(db: Db, apply: boolean, report: ReturnType<typeof createReportWriter>) {
  const specs: Array<{ collection: string; key: Record<string, 1>; name: string }> = [
    {
      collection: REGISTRY_COLLECTIONS.tenantMembers,
      key: { tenantId: 1, authUserId: 1 },
      name: 'tenantId_1_authUserId_1',
    },
    {
      collection: REGISTRY_COLLECTIONS.tenantMembers,
      key: { authUserId: 1, status: 1 },
      name: 'authUserId_1_status_1',
    },
    {
      collection: REGISTRY_COLLECTIONS.companyMembers,
      key: { authUserId: 1, status: 1 },
      name: 'authUserId_1_status_1',
    },
  ];

  for (const spec of specs) {
    if (!apply) {
      report.line(`  [dry-run] criaria índice ${spec.collection}.${spec.name}`);
      continue;
    }
    try {
      await db.collection(spec.collection).createIndex(spec.key, { name: spec.name });
      report.line(`  criado/ok índice ${spec.collection}.${spec.name}`);
    } catch (error) {
      report.line(
        `  índice ${spec.collection}.${spec.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

async function verifyDocumentOwnerReferences(
  db: Db,
  report: ReturnType<typeof createReportWriter>,
): Promise<{ checkedOwners: number; missingOwners: number }> {
  const tenants = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).find({}).toArray();

  let checkedOwners = 0;
  let missingOwners = 0;
  const missingSamples: string[] = [];

  for (const tenant of tenants) {
    let names;
    try {
      names = resolveSharedCollections();
    } catch {
      continue;
    }
    if (!names.documents) continue;

    const ownerIds = await db.collection(names.documents).distinct('ownerUserId');
    const ids = ownerIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (!ids.length) continue;

    const members = await db
      .collection(REGISTRY_COLLECTIONS.tenantMembers)
      .find({
        tenantId: tenant.tenantId,
        $or: [{ authUserId: { $in: ids } }, { keycloakUserId: { $in: ids } }, { memberId: { $in: ids } }],
      })
      .project({ authUserId: 1, keycloakUserId: 1, memberId: 1 })
      .toArray();

    const legacyMembers = await db
      .collection(REGISTRY_COLLECTIONS.companyMembers)
      .find({
        $or: [{ tenantId: tenant.tenantId }, { companyId: tenant.tenantId }],
        $and: [
          {
            $or: [
              { authUserId: { $in: ids } },
              { keycloakUserId: { $in: ids } },
              { userId: { $in: ids } },
            ],
          },
        ],
      })
      .project({ authUserId: 1, keycloakUserId: 1, userId: 1 })
      .toArray();

    const known = new Set<string>();
    for (const member of members) {
      if (typeof member.authUserId === 'string') known.add(member.authUserId);
      if (typeof member.keycloakUserId === 'string') known.add(member.keycloakUserId);
      if (typeof member.memberId === 'string') known.add(member.memberId);
    }
    for (const member of legacyMembers) {
      if (typeof member.authUserId === 'string') known.add(member.authUserId);
      if (typeof member.keycloakUserId === 'string') known.add(member.keycloakUserId);
      if (typeof member.userId === 'string') known.add(member.userId);
    }

    for (const ownerId of ids) {
      checkedOwners += 1;
      if (known.has(ownerId)) continue;
      missingOwners += 1;
      if (missingSamples.length < 30) {
        missingSamples.push(`${tenant.tenantId}/${ownerId}`);
      }
    }
  }

  report.section('Integridade ownerUserId ↔ membros');
  report.line(`Owners checados: ${checkedOwners}`);
  report.line(`Owners sem membro correspondente: ${missingOwners}`);
  if (missingSamples.length) {
    report.line('Amostras:');
    for (const sample of missingSamples) report.line(`  - ${sample}`);
  }

  return { checkedOwners, missingOwners };
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = hasApplyArg();
  const report = createReportWriter();
  const db = await getDb();
  const dbName = getMongoDatabaseName();

  report.section('Migração keycloakUserId → authUserId');
  report.line(`Database: ${dbName}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  report.line(`Campo legado: ${LEGACY_FIELD}`);
  report.line(`Campo novo: ${NEW_FIELD}`);

  const collectionNames = await listCollectionNames(db);
  const stats: CollectionRenameStats[] = [];

  report.section('Collections com campo legado');
  for (const name of collectionNames) {
    const result = await migrateCollection(db, name, apply);
    if (!result) continue;
    stats.push(result);
    report.line(
      `- ${name}: legacyOnly=${result.withLegacyOnly} both=${result.withBoth} conflicts=${result.conflicts}` +
        (apply
          ? ` renamed=${result.renamed} unsetDup=${result.unsetDuplicate}`
          : ''),
    );
  }

  if (stats.length === 0) {
    report.line('(nenhuma collection com keycloakUserId)');
  }

  report.section('Índices');
  await ensureAuthUserIdIndexes(db, apply, report);
  if (apply) {
    for (const name of [
      REGISTRY_COLLECTIONS.tenantMembers,
      REGISTRY_COLLECTIONS.companyMembers,
      ...stats.map((s) => s.collection),
    ]) {
      await dropLegacyIndexes(db, name, report);
    }
  } else {
    report.line('[dry-run] índices legados keycloakUserId seriam dropados após rename');
  }

  const integrity = await verifyDocumentOwnerReferences(db, report);

  report.section('Resumo');
  report.line(`Collections afetadas: ${stats.length}`);
  report.line(`Renomes aplicados: ${stats.reduce((sum, s) => sum + s.renamed, 0)}`);
  report.line(`Duplicatas unset: ${stats.reduce((sum, s) => sum + s.unsetDuplicate, 0)}`);
  report.line(`Conflitos (ambos campos divergentes): ${stats.reduce((sum, s) => sum + s.conflicts, 0)}`);
  report.line(`Owners sem membro: ${integrity.missingOwners}`);
  if (!apply) {
    report.line('Nenhuma alteração aplicada. Use --apply (ou MIGRATION_APPLY=true) para executar.');
  }

  report.write(REPORT_PATH);
  console.log(report.lines.join('\n'));
  console.log(`\nRelatório: ${REPORT_PATH}`);

  const hardFail = stats.some((s) => s.conflicts > 0);
  if (integrity.missingOwners > 0) {
    report.line(
      'AVISO: há ownerUserId sem membro correspondente (órfãos pré-existentes; o rename não altera ownerUserId).',
    );
  }
  await closeMongoConnection();
  process.exit(hardFail ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await closeMongoConnection().catch(() => undefined);
  process.exit(1);
});
