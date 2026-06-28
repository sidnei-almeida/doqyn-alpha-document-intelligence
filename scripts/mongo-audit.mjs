#!/usr/bin/env node
/**
 * Auditoria read-only do cluster MongoDB Atlas.
 * Não apaga nem altera dados.
 *
 * Uso: npm run mongo:audit
 * Saída: docs/mongo-audit-report.json + resumo no stdout
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import {
  classifyCollection,
  classifyDatabase,
  getActiveDatabaseName,
  getLegacyDatabaseName,
} from './mongo-cleanup/classification.mjs';
import {
  maskDocument,
  maskUri,
  pickLatestTimestamp,
  requireMongoUri,
} from './mongo-cleanup/env.mjs';

const REPORT_DIR = join(process.cwd(), 'docs');
const REPORT_JSON = join(REPORT_DIR, 'mongo-audit-report.json');
const REPORT_TXT = join(REPORT_DIR, 'mongo-audit-report.txt');

async function inspectCollection(db, databaseName, collectionName, activeDatabase) {
  const collection = db.collection(collectionName);
  const classification = classifyCollection(databaseName, collectionName, activeDatabase);

  let estimatedDocumentCount = 0;
  try {
    estimatedDocumentCount = await collection.estimatedDocumentCount();
  } catch {
    estimatedDocumentCount = -1;
  }

  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch {
    indexes = [];
  }

  let sampleDocument = null;
  try {
    const doc = await collection.findOne({});
    sampleDocument = doc ? maskDocument(doc) : null;
  } catch {
    sampleDocument = null;
  }

  let latestTimestamp = null;
  try {
    latestTimestamp = await pickLatestTimestamp(collection);
  } catch {
    latestTimestamp = null;
  }

  return {
    database: databaseName,
    collection: collectionName,
    classification,
    estimatedDocumentCount,
    indexes: indexes.map((idx) => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) })),
    latestTimestamp,
    sampleDocument,
  };
}

function summarizeByClassification(items) {
  const map = {};
  for (const item of items) {
    map[item.classification] = (map[item.classification] ?? 0) + 1;
  }
  return map;
}

function formatReportText(report) {
  const lines = [];
  lines.push('='.repeat(72));
  lines.push('AUDITORIA MONGODB DOQYN — READ ONLY');
  lines.push('='.repeat(72));
  lines.push(`Gerado em: ${report.generatedAt}`);
  lines.push(`MONGODB_URI (mascarada): ${report.connection.uriMasked}`);
  lines.push(`Database ativo (runtime): ${report.runtime.activeDatabase}`);
  lines.push(`Database legado (referência): ${report.runtime.legacyDatabase}`);
  lines.push(`Database no URI: ${report.runtime.databaseInUri ?? 'não especificado (usa MONGODB_DATABASE)'}`);
  lines.push('');
  lines.push('--- DATABASES ---');
  for (const db of report.databases) {
    lines.push(`  [${db.classification}] ${db.name} (${db.collectionCount} collections)`);
  }
  lines.push('');
  lines.push('--- COLLECTIONS POR CLASSIFICAÇÃO ---');
  for (const [cls, count] of Object.entries(report.summary.collectionsByClassification)) {
    lines.push(`  ${cls}: ${count}`);
  }
  lines.push('');
  lines.push('--- COLLECTIONS (detalhe) ---');
  for (const col of report.collections) {
    lines.push(
      `  [${col.classification}] ${col.database}.${col.collection} — docs≈${col.estimatedDocumentCount}` +
        (col.latestTimestamp ? ` — latest: ${col.latestTimestamp}` : ''),
    );
  }
  lines.push('');
  lines.push('Relatório JSON completo: docs/mongo-audit-report.json');
  lines.push('='.repeat(72));
  return lines.join('\n');
}

async function main() {
  const uri = requireMongoUri();
  const activeDatabase = getActiveDatabaseName();
  const legacyDatabase = getLegacyDatabaseName();

  let databaseInUri = null;
  try {
    const parsed = new URL(uri);
    const pathDb = parsed.pathname?.replace(/^\//, '').trim();
    databaseInUri = pathDb || null;
  } catch {
    databaseInUri = null;
  }

  console.log('Conectando ao MongoDB (read-only)...');
  console.log('URI:', maskUri(uri));
  console.log('Database ativo:', activeDatabase);
  console.log('Database legado:', legacyDatabase);
  console.log('');

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const admin = client.db().admin();
    const { databases: dbList } = await admin.listDatabases();

    const databases = [];
    const collections = [];

    for (const entry of dbList) {
      const dbName = entry.name;
      const classification = classifyDatabase(dbName, activeDatabase, legacyDatabase);
      const db = client.db(dbName);
      const colInfos = await db.listCollections().toArray();

      databases.push({
        name: dbName,
        classification,
        sizeOnDisk: entry.sizeOnDisk ?? null,
        collectionCount: colInfos.length,
      });

      for (const colInfo of colInfos) {
        const colName = colInfo.name;
        if (colName.startsWith('system.')) continue;

        const inspected = await inspectCollection(db, dbName, colName, activeDatabase);
        collections.push(inspected);
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      connection: {
        uriMasked: maskUri(uri),
        databaseInUri,
      },
      runtime: {
        activeDatabase,
        legacyDatabase,
        envMongoDatabase: process.env.MONGODB_DATABASE?.trim() || null,
        envMongoDbNameLegacy: process.env.MONGODB_DB_NAME?.trim() || null,
      },
      databases: databases.sort((a, b) => a.name.localeCompare(b.name)),
      collections: collections.sort((a, b) =>
        `${a.database}.${a.collection}`.localeCompare(`${b.database}.${b.collection}`),
      ),
      summary: {
        databasesByClassification: summarizeByClassification(databases),
        collectionsByClassification: summarizeByClassification(collections),
      },
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
    const text = formatReportText(report);
    writeFileSync(REPORT_TXT, text, 'utf8');

    console.log(text);
    console.log('\nAuditoria concluída. Nenhum dado foi alterado.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Falha na auditoria:', error instanceof Error ? error.message : error);
  process.exit(1);
});
