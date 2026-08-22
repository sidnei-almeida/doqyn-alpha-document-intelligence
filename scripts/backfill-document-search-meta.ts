/**
 * Backfill `documents.searchMeta` a partir de `document_versions.metadata`.
 * Opcionalmente remove projeções mortas: currentMetadataPreview / metadataIndex.
 *
 * Dry-run por padrão:
 *   npm run db:backfill-search-meta
 * Aplicar:
 *   npm run db:backfill-search-meta -- --apply
 * Também unset peso morto:
 *   npm run db:backfill-search-meta -- --apply --unset-dead
 */
import 'dotenv/config';
import { join } from 'node:path';
import type { Db } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type {
  MongoDocument,
  MongoDocumentVersion,
  MongoTenant,
  MongoVersionMetadataField,
} from '../server/db/types.js';
import { projectDocumentSearchMeta } from '../server/services/confirm/projectSearchMeta.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_BACKFILL_SEARCH_META.txt');

function hasApplyArg(): boolean {
  return process.argv.includes('--apply') || isApplyFlag('MIGRATION_APPLY');
}

function hasUnsetDeadArg(): boolean {
  return process.argv.includes('--unset-dead');
}

type PairStats = {
  documents: string;
  versions: string;
  docsScanned: number;
  needingBackfill: number;
  updated: number;
  skippedNoVersion: number;
  skippedNoMetadata: number;
  previewUnset: number;
  indexUnset: number;
};

async function backfillPair(
  db: Db,
  documentsName: string,
  versionsName: string,
  apply: boolean,
  unsetDead: boolean,
): Promise<PairStats> {
  const docs = db.collection<MongoDocument>(documentsName);
  const versions = db.collection<MongoDocumentVersion>(versionsName);

  const stats: PairStats = {
    documents: documentsName,
    versions: versionsName,
    docsScanned: 0,
    needingBackfill: 0,
    updated: 0,
    skippedNoVersion: 0,
    skippedNoMetadata: 0,
    previewUnset: 0,
    indexUnset: 0,
  };

  const cursor = docs.find(
    {},
    {
      projection: {
        _id: 1,
        currentVersionId: 1,
        searchMeta: 1,
        currentMetadataPreview: 1,
      },
    },
  );

  for await (const doc of cursor) {
    stats.docsScanned += 1;
    const hasPeople = Array.isArray(doc.searchMeta?.people) && doc.searchMeta.people.length > 0;
    const hasDates = Array.isArray(doc.searchMeta?.dates) && doc.searchMeta.dates.length > 0;
    const hasSearchMeta = Boolean(doc.searchMeta) && (hasPeople || hasDates || doc.searchMeta?.documentTitle || doc.searchMeta?.validityDate);
    const needsUnsetPreview = unsetDead && doc.currentMetadataPreview !== undefined;

    if (hasSearchMeta && !needsUnsetPreview) {
      continue;
    }

    stats.needingBackfill += 1;

    if (!doc.currentVersionId) {
      stats.skippedNoVersion += 1;
      continue;
    }

    const version = await versions.findOne(
      { _id: doc.currentVersionId } as Record<string, unknown>,
      { projection: { metadata: 1, metadataIndex: 1 } },
    );

    if (!version) {
      stats.skippedNoVersion += 1;
      continue;
    }

    const metadata = (version.metadata ?? {}) as Record<string, MongoVersionMetadataField>;
    if (Object.keys(metadata).length === 0 && hasSearchMeta) {
      // só unset de preview
    } else if (Object.keys(metadata).length === 0) {
      stats.skippedNoMetadata += 1;
      if (!needsUnsetPreview) continue;
    }

    const searchMeta = projectDocumentSearchMeta(metadata);

    if (apply) {
      const $set: Record<string, unknown> = { searchMeta };
      const $unset: Record<string, ''> = {};
      if (unsetDead) {
        $unset.currentMetadataPreview = '';
        stats.previewUnset += 1;
      }

      await docs.updateOne(
        { _id: doc._id } as Record<string, unknown>,
        Object.keys($unset).length > 0 ? { $set, $unset } : { $set },
      );

      stats.updated += 1;
    }
  }

  if (apply && unsetDead) {
    const indexResult = await versions.updateMany(
      { metadataIndex: { $exists: true } },
      { $unset: { metadataIndex: '' } },
    );
    stats.indexUnset += indexResult.modifiedCount;
  }

  return stats;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = hasApplyArg();
  const unsetDead = hasUnsetDeadArg();
  const db = await getDb();
  const database = getMongoDatabaseName();
  const report = createReportWriter();

  report.section('Backfill documents.searchMeta');
  report.line(`Database: ${database}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  report.line(`Unset peso morto: ${unsetDead ? 'sim' : 'não'}`);

  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: { $in: ['active', 'pending'] } })
    .toArray();

  // Coleções compartilhadas: um único par para todos os tenants. O laço por tenant sumiu junto
  // com as coleções prefixadas.
  const shared = resolveSharedCollections();
  const pairs = new Map<string, { documents: string; versions: string }>([
    [shared.documents, { documents: shared.documents, versions: shared.documentVersions }],
  ]);

  const allStats: PairStats[] = [];
  for (const pair of pairs.values()) {
    const exists = await db.listCollections({ name: pair.documents }).hasNext();
    if (!exists) continue;
    const stats = await backfillPair(db, pair.documents, pair.versions, apply, unsetDead);
    allStats.push(stats);
    report.line(
      `${pair.documents}: scanned=${stats.docsScanned} need=${stats.needingBackfill} updated=${stats.updated} noVersion=${stats.skippedNoVersion} noMeta=${stats.skippedNoMetadata} previewUnset=${stats.previewUnset} indexUnset=${stats.indexUnset}`,
    );
  }

  const totals = allStats.reduce(
    (acc, s) => {
      acc.docsScanned += s.docsScanned;
      acc.needingBackfill += s.needingBackfill;
      acc.updated += s.updated;
      acc.previewUnset += s.previewUnset;
      acc.indexUnset += s.indexUnset;
      return acc;
    },
    { docsScanned: 0, needingBackfill: 0, updated: 0, previewUnset: 0, indexUnset: 0 },
  );

  report.section('TOTAIS');
  report.line(`Docs: ${totals.docsScanned}`);
  report.line(`Precisam backfill: ${totals.needingBackfill}`);
  report.line(`Atualizados: ${totals.updated}`);
  report.line(`Preview unset: ${totals.previewUnset}`);
  report.line(`metadataIndex unset: ${totals.indexUnset}`);
  if (!apply) {
    report.line('Execute com --apply para gravar; --unset-dead remove preview/index mortos.');
  }

  report.write(REPORT_PATH);
  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(
    `Database: ${database} | scanned=${totals.docsScanned} need=${totals.needingBackfill} updated=${totals.updated} (${apply ? 'APPLY' : 'DRY-RUN'})`,
  );

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongoConnection().catch(() => undefined);
  process.exit(1);
});
