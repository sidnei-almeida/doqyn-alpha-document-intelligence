import 'dotenv/config';
import { join } from 'node:path';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveTenantCollectionNames } from '../server/tenancy/tenantResolver.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';
import { buildDevStorageObjectKey } from './lib/devStorage.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_FIX_DOCUMENT_VERSION_STORAGE.txt');

function getTenantId(doc: Record<string, unknown>): string | undefined {
  const id = doc.tenantId ?? doc.companyId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

function versionNeedsStorageFix(version: Record<string, unknown>): boolean {
  const storage = version.storage as Record<string, unknown> | undefined;
  const primary = storage?.primary as Record<string, unknown> | undefined;
  const backup = storage?.backup as Record<string, unknown> | undefined;
  const storageKey = primary?.objectKey ?? backup?.objectKey;
  return !storageKey || (typeof storageKey === 'string' && !storageKey.trim());
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = isApplyFlag('FIX_VERSION_STORAGE_APPLY');
  const db = await getDb();
  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  let scanned = 0;
  let affected = 0;
  let applied = 0;
  const details: string[] = [];

  for (const tenant of tenants) {
    const names = resolveTenantCollectionNames(tenant);
    const col = db.collection(names.documentVersions);
    const versions = await col.find({}).toArray();

    for (const version of versions) {
      scanned += 1;
      const doc = version as Record<string, unknown>;
      if (!versionNeedsStorageFix(doc)) continue;

      affected += 1;
      const tenantId = getTenantId(doc) ?? tenant.tenantId;
      const documentId = String(doc.documentId ?? 'unknown');
      const versionNumber = Number(doc.versionNumber ?? 1);
      const objectKey = buildDevStorageObjectKey(tenantId, documentId, versionNumber);

      details.push(
        `${names.documentVersions} | ${String(doc._id)} | objectKey dev seria atribuído`,
      );

      if (apply) {
        await col.updateOne(
          { _id: doc._id },
          {
            $set: {
              'storage.primary.provider': 'aws_s3',
              'storage.primary.status': 'pending',
              'storage.primary.objectKey': objectKey,
              'storage.primary.bucketAlias': 'dev-local',
              'storage.backup.provider': 'cloudflare_r2',
              'storage.backup.status': 'pending',
              'storage.backup.objectKey': objectKey,
              'storage.backup.bucketAlias': 'dev-backup',
              updatedAt: new Date(),
            },
          },
        );
        applied += 1;
      }
    }
  }

  const report = createReportWriter();
  report.line('DOQYN — Correção de objectKey/storage em document_versions');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  report.section('RESUMO');
  report.line(`Versions escaneadas: ${scanned}`);
  report.line(`Sem objectKey/storage: ${affected}`);
  report.line(`Corrigidas: ${applied}`);

  report.section('DETALHES (sem valores sensíveis)');
  if (details.length === 0) {
    report.line('Nenhuma version pendente.');
  } else {
    for (const line of details) report.line(line);
  }

  if (!apply && affected > 0) {
    report.section('PRÓXIMO PASSO');
    report.line('FIX_VERSION_STORAGE_APPLY=true npm run db:fix-version-storage');
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'} | Afetadas: ${affected} | Aplicadas: ${applied}`);

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : 'unknown');
  await closeMongoConnection();
  process.exit(1);
});
