import 'dotenv/config';
import { join } from 'node:path';
import type { Document } from 'mongodb';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import { createReportWriter, getEnvTenantId, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_MIGRACAO_FLAT_TO_TENANT.txt');

type MigrationStats = {
  source: string;
  target: string;
  sourceCount: number;
  targetBefore: number;
  wouldMigrate: number;
  migrated: number;
  skippedDuplicate: number;
  conflicts: number;
  incompatible: number;
};

function getTenantId(doc: Document): string | undefined {
  const id = doc.tenantId ?? doc.companyId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = isApplyFlag('MIGRATION_APPLY');
  const deleteLegacy = isApplyFlag('MIGRATION_DELETE_LEGACY');
  const tenantId = getEnvTenantId();

  const db = await getDb();
  const tenant = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    $or: [{ tenantId }, { companyId: tenantId }],
  } as Record<string, unknown>);

  if (!tenant) {
    console.error(`Tenant não encontrado: ${tenantId}`);
    process.exit(1);
  }

  const names = resolveSharedCollections();
  const targetMap: Record<string, string> = {
    access_groups: names.accessGroups ?? '',
    document_classes: names.documentClasses ?? '',
    document_rules: names.documentRules ?? '',
    documents: names.documents,
    document_versions: names.documentVersions,
    processing_jobs: names.processingJobs,
    audit_logs: names.auditLogs,
  };

  const stats: MigrationStats[] = [];

  for (const [flatName, targetName] of Object.entries(targetMap)) {
    if (!targetName) continue;

    const sourceCol = db.collection(flatName);
    const targetCol = db.collection(targetName);
    const sourceCount = await sourceCol.countDocuments();
    const targetBefore = await targetCol.countDocuments();

    const stat: MigrationStats = {
      source: flatName,
      target: targetName,
      sourceCount,
      targetBefore,
      wouldMigrate: 0,
      migrated: 0,
      skippedDuplicate: 0,
      conflicts: 0,
      incompatible: 0,
    };

    const cursor = sourceCol.find({});
    for await (const doc of cursor) {
      const docTenantId = getTenantId(doc);
      if (docTenantId && docTenantId !== tenant.tenantId) {
        stat.incompatible += 1;
        continue;
      }

      const existing = await targetCol.findOne({ _id: doc._id });
      if (existing) {
        stat.skippedDuplicate += 1;
        continue;
      }

      stat.wouldMigrate += 1;

      if (apply) {
        const payload: Document = {
          ...doc,
          tenantId: tenant.tenantId,
          companyId: tenant.tenantId,
          migratedFrom: 'flat_collection',
          migratedAt: new Date(),
        };

        try {
          await targetCol.insertOne(payload);
          stat.migrated += 1;
        } catch {
          stat.conflicts += 1;
        }
      }
    }

    stats.push(stat);
  }

  const report = createReportWriter();
  report.line('DOQYN — Migração flat → coleções prefixadas por tenant');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Tenant: ${tenant.tenantId} | Prefix: ${tenant.isolation.collectionPrefix}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  report.line(`Delete legacy: ${deleteLegacy ? 'SIM (não executado nesta etapa)' : 'NÃO'}`);
  report.line('Relatório sanitizado — sem PII.');

  report.section('CONTAGENS POR COLEÇÃO');
  for (const s of stats) {
    report.line(`\n${s.source} → ${s.target}`);
    report.line(`  Origem: ${s.sourceCount}`);
    report.line(`  Destino (antes): ${s.targetBefore}`);
    report.line(`  Seriam migrados: ${s.wouldMigrate}`);
    report.line(`  Migrados: ${s.migrated}`);
    report.line(`  Ignorados (duplicidade _id): ${s.skippedDuplicate}`);
    report.line(`  Conflitos: ${s.conflicts}`);
    report.line(`  Incompatíveis (tenantId): ${s.incompatible}`);
  }

  report.section('ROLLBACK MANUAL');
  report.line('Para reverter migração por coleção:');
  report.line('  db.<target>.deleteMany({ migratedFrom: "flat_collection" })');
  report.line('Coleções flat originais NÃO são removidas automaticamente.');

  if (!apply) {
    report.section('PRÓXIMO PASSO');
    report.line('Para aplicar: MIGRATION_APPLY=true npm run db:migrate-flat-to-tenant');
    report.line('Para deletar legado (futuro): MIGRATION_DELETE_LEGACY=true (requer backup)');
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'} | Tenant: ${tenant.tenantId}`);

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
