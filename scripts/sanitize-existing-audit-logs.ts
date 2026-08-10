import 'dotenv/config';
import { join } from 'node:path';
import { COLLECTIONS, REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoTenant } from '../server/db/types.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import {
  isForbiddenAuditMetadataKey,
  sanitizeAuditMetadata,
} from '../server/utils/sanitizeAuditMetadata.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_SANITIZE_AUDIT_LOGS.txt');

type CollectionStats = {
  collection: string;
  scanned: number;
  affected: number;
  applied: number;
  fieldsRemoved: Map<string, number>;
};

function collectRemovedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  removed: Map<string, number>,
) {
  for (const key of Object.keys(before)) {
    if (!(key in after) || isForbiddenAuditMetadataKey(key)) {
      removed.set(key, (removed.get(key) ?? 0) + 1);
    }
  }
}

function metadataNeedsSanitization(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  for (const key of Object.keys(metadata as Record<string, unknown>)) {
    if (isForbiddenAuditMetadataKey(key)) return true;
  }
  return false;
}

async function resolveAuditCollections(db: Awaited<ReturnType<typeof getDb>>): Promise<string[]> {
  const names = new Set<string>();

  const tenants = await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray();

  for (const tenant of tenants) {
    const resolved = resolveSharedCollections();
    if (resolved.auditLogs) names.add(resolved.auditLogs);
  }

  if (await db.listCollections({ name: COLLECTIONS.auditLogs }).hasNext()) {
    names.add(COLLECTIONS.auditLogs);
  }

  return [...names].sort();
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = isApplyFlag('SANITIZE_AUDIT_APPLY');
  const db = await getDb();
  const collections = await resolveAuditCollections(db);
  const stats: CollectionStats[] = [];

  for (const collectionName of collections) {
    const col = db.collection(collectionName);
    const scanned = await col.countDocuments();
    const stat: CollectionStats = {
      collection: collectionName,
      scanned,
      affected: 0,
      applied: 0,
      fieldsRemoved: new Map(),
    };

    const cursor = col.find({});
    for await (const log of cursor) {
      if (!metadataNeedsSanitization(log.metadata)) continue;

      stat.affected += 1;
      const before = (log.metadata ?? {}) as Record<string, unknown>;
      const after = sanitizeAuditMetadata(before);
      collectRemovedFields(before, after, stat.fieldsRemoved);

      if (apply) {
        await col.updateOne({ _id: log._id }, { $set: { metadata: after } });
        stat.applied += 1;
      }
    }

    stats.push(stat);
  }

  const report = createReportWriter();
  report.line('DOQYN — Sanitização de audit_logs existentes');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  report.line('Valores sensíveis não são exibidos neste relatório.');

  report.section('RESUMO');
  const totalAffected = stats.reduce((sum, s) => sum + s.affected, 0);
  const totalApplied = stats.reduce((sum, s) => sum + s.applied, 0);
  report.line(`Coleções processadas: ${stats.length}`);
  report.line(`Logs afetados: ${totalAffected}`);
  report.line(`Logs corrigidos: ${totalApplied}`);

  report.section('DETALHES POR COLEÇÃO');
  for (const s of stats) {
    report.line(`\n${s.collection}`);
    report.line(`  Escaneados: ${s.scanned}`);
    report.line(`  Afetados: ${s.affected}`);
    report.line(`  Aplicados: ${s.applied}`);
    if (s.fieldsRemoved.size > 0) {
      report.line('  Campos removidos:');
      for (const [field, count] of s.fieldsRemoved.entries()) {
        report.line(`    - ${field}: ${count}`);
      }
    }
  }

  if (!apply && totalAffected > 0) {
    report.section('PRÓXIMO PASSO');
    report.line('SANITIZE_AUDIT_APPLY=true npm run db:sanitize-audit-logs');
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'} | Afetados: ${totalAffected} | Aplicados: ${totalApplied}`);

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : 'unknown');
  await closeMongoConnection();
  process.exit(1);
});
