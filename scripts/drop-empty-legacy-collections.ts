/**
 * Drop de collections legado vazias (document_classes_*, access_groups_*).
 * Dry-run por padrão. Aplicar:
 *   npm run db:drop-empty-legacy -- --apply
 */
import 'dotenv/config';
import { join } from 'node:path';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_DROP_EMPTY_LEGACY.txt');

const LEGACY_PREFIXES = ['document_classes_', 'access_groups_'] as const;
const LEGACY_EXACT = ['document_classes', 'access_groups'] as const;

function hasApplyArg(): boolean {
  return process.argv.includes('--apply') || isApplyFlag('MIGRATION_APPLY');
}

function isLegacyCandidate(name: string): boolean {
  if ((LEGACY_EXACT as readonly string[]).includes(name)) return true;
  return LEGACY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = hasApplyArg();
  const db = await getDb();
  const database = getMongoDatabaseName();
  const report = createReportWriter();

  report.section('Drop collections legado vazias');
  report.line(`Database: ${database}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter(isLegacyCandidate)
    .sort();

  let dropped = 0;
  let skippedNonEmpty = 0;

  for (const name of names) {
    const count = await db.collection(name).countDocuments({});
    if (count > 0) {
      skippedNonEmpty += 1;
      report.line(`SKIP (não vazia, ${count} docs): ${name}`);
      continue;
    }
    if (apply) {
      await db.dropCollection(name);
      dropped += 1;
      report.line(`DROPPED: ${name}`);
    } else {
      report.line(`WOULD_DROP: ${name}`);
      dropped += 1;
    }
  }

  report.section('TOTAIS');
  report.line(`Candidatas: ${names.length}`);
  report.line(`${apply ? 'Dropped' : 'Would drop'}: ${dropped}`);
  report.line(`Skipped non-empty: ${skippedNonEmpty}`);
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(
    `Database: ${database} | candidatas=${names.length} ${apply ? 'dropped' : 'wouldDrop'}=${dropped} skippedNonEmpty=${skippedNonEmpty}`,
  );

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongoConnection().catch(() => undefined);
  process.exit(1);
});
