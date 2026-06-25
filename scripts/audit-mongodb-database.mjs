/**
 * Auditoria do database MongoDB e validação de documento NDA salvo.
 * Uso: npx tsx scripts/audit-mongodb-database.mjs
 */
import 'dotenv/config';
import { getMongoDatabaseName } from '../server/db/database.ts';

const COLLECTIONS = [
  'document_classes',
  'document_rules',
  'documents',
  'document_versions',
  'processing_jobs',
  'audit_logs',
];

async function inspectDatabase(client, dbName) {
  const db = client.db(dbName);
  const counts = {};
  for (const name of COLLECTIONS) {
    counts[name] = await db.collection(name).countDocuments();
  }

  const ndaDocs = await db
    .collection('documents')
    .find({ classId: 'class_confidentiality_agreement' })
    .toArray();

  const latestDoc = await db
    .collection('documents')
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  const target = ndaDocs[0] ?? latestDoc[0] ?? null;
  let validation = null;

  if (target) {
    const version = await db.collection('document_versions').findOne({
      _id: target.currentVersionId,
      companyId: target.companyId,
    });

    const jobs = await db
      .collection('processing_jobs')
      .find({ documentId: target._id, companyId: target.companyId })
      .toArray();

    const audits = await db
      .collection('audit_logs')
      .find({ documentId: target._id, companyId: target.companyId })
      .toArray();

    const snippetLengths = version
      ? Object.values(version.metadata ?? {}).map((field) => {
          const evidence = field?.evidence?.snippet;
          return evidence ? evidence.length : 0;
        })
      : [];

    validation = {
      documentId: target._id,
      documentCode: target.documentCode,
      classId: target.classId,
      className: target.className,
      currentVersionId: target.currentVersionId,
      versionExists: Boolean(version),
      versionNumber: version?.versionNumber ?? null,
      storagePrimaryPending: version?.storage?.primary?.status === 'pending',
      storageBackupPending: version?.storage?.backup?.status === 'pending',
      metadataFieldCount: version ? Object.keys(version.metadata ?? {}).length : 0,
      maxEvidenceSnippetLength: snippetLengths.length ? Math.max(...snippetLengths) : 0,
      processingJobs: jobs.length,
      auditLogs: audits.length,
      auditActions: audits.map((item) => item.action),
      hasFullPdfText: false,
      hasDocumentChunksCollection: false,
    };
  }

  return { dbName, counts, validation };
}

async function main() {
  const effectiveDatabase = getMongoDatabaseName();
  const legacyDatabase = process.env.MONGODB_DB_NAME?.trim() || 'doqyn_alpha';

  console.log('=== Auditoria MongoDB DOQYN ===');
  console.log('MONGODB_DATABASE (env):', process.env.MONGODB_DATABASE?.trim() || '(não definido)');
  console.log('MONGODB_DB_NAME (legado, ignorado pelo app):', process.env.MONGODB_DB_NAME?.trim() || '(não definido)');
  console.log('Database efetivo do app:', effectiveDatabase);
  console.log('');

  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não configurada');
  }

  const client = new MongoClient(uri);
  await client.connect();

  const primary = await inspectDatabase(client, effectiveDatabase);
  console.log('--- Database efetivo ---');
  console.log(JSON.stringify(primary, null, 2));

  if (legacyDatabase !== effectiveDatabase) {
    const legacy = await inspectDatabase(client, legacyDatabase);
    console.log('\n--- Database legado (dados anteriores) ---');
    console.log(JSON.stringify(legacy, null, 2));
  }

  const chunksInPrimary = await client
    .db(effectiveDatabase)
    .listCollections({ name: 'document_chunks' })
    .toArray();

  console.log('\ndocument_chunks no database efetivo:', chunksInPrimary.length > 0 ? 'EXISTE' : 'ausente');

  await client.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
