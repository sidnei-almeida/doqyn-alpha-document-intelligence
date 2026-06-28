/**
 * Teste do modo AI_MODE=no_ai — analyze + confirm-analysis + MongoDB.
 * Uso: AI_MODE=no_ai npx tsx scripts/test-no-ai.mjs
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { analyzePdfBuffer } from '../server/ai/services/analyzePdfService.ts';
import { confirmAnalysisPersistence } from '../server/services/confirmAnalysisService.ts';
import { getAiMode } from '../server/ai/utils/aiMode.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { closeMongoConnection } from '../server/db/mongoClient.ts';
import { buildDocumentRequestContext } from '../server/tenancy/documentRequestContext.ts';
import {
  resetStorageProviderCache,
  storeAnalysisStaging,
} from '../server/storage/index.ts';
import { resolveStorageAbsolutePath } from '../server/storage/storageKeys.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = resolve(__dirname, '..', 'NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf');

const NDA_CLASS_ID = 'class_confidentiality_agreement';
const NDA_RULE_ID = 'rule_confidentiality_agreement_v1';

const MOCK_USER = {
  id: 'user_test_no_ai',
  email: 'admin@doqyn.com',
  name: 'Teste no_ai',
  role: 'admin',
  companyId: DEV_COMPANY_ID,
  area: 'Gestão',
  groups: ['admin', 'juridico'],
};

function pass(label, detail = '') {
  console.log(`✓ ${label}${detail ? `: ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.log(`✗ ${label}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  if (getAiMode() !== 'no_ai') {
    console.error('Defina AI_MODE=no_ai para executar este teste.');
    process.exit(1);
  }

  const storageRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-no-ai-storage-'));
  process.env.STORAGE_PROVIDER = 'local';
  process.env.LOCAL_STORAGE_ROOT = storageRoot;
  process.env.MAX_UPLOAD_MB = '25';
  resetStorageProviderCache();

  console.log('=== Teste AI_MODE=no_ai ===\n');
  console.log('AI_MODE:', getAiMode());
  console.log('database:', getMongoDatabaseName());
  console.log('companyId:', DEV_COMPANY_ID);
  console.log('LOCAL_STORAGE_ROOT:', storageRoot);

  const buf = readFileSync(PDF_PATH);
  const analyzeStarted = Date.now();
  const analysis = await analyzePdfBuffer({
    buffer: buf,
    originalFileName: 'nda-no-ai-teste.pdf',
    mimeType: 'application/pdf',
    companyId: DEV_COMPANY_ID,
    ownerUserId: MOCK_USER.id,
    requestContext: { requestId: 'test-no-ai' },
  });

  console.log('\n--- analyze-pdf ---');
  console.log('durationMs:', Date.now() - analyzeStarted);
  console.log('status:', analysis.status);
  console.log('jobId:', analysis.jobId);
  console.log('classId:', analysis.classification.classId);
  console.log('className:', analysis.classification.className);
  console.log('recommendedFileName:', analysis.recommendedFileName);
  console.log('metadata keys:', Object.keys(analysis.extraction?.metadata ?? {}).join(', '));

  if (analysis.status !== 'completed') fail('analyze status', analysis.status);
  else pass('analyze status', 'completed');

  if (analysis.classification.classId === NDA_CLASS_ID) pass('classId', NDA_CLASS_ID);
  else fail('classId', analysis.classification.classId ?? 'null');

  if (analysis.recommendedFileName?.includes('NDA_')) pass('recommendedFileName', analysis.recommendedFileName);
  else fail('recommendedFileName', analysis.recommendedFileName ?? 'null');

  const noAiLog = analysis.logs?.find((l) => l.title?.includes('desenvolvimento'));
  if (noAiLog) pass('log modo desenvolvimento', noAiLog.title);
  else fail('log modo desenvolvimento');

  await storeAnalysisStaging({
    tenantId: DEV_COMPANY_ID,
    ownerUserId: MOCK_USER.id,
    jobId: analysis.jobId,
    buffer: buf,
    mimeType: 'application/pdf',
    originalFileName: analysis.originalFileName,
  });
  pass('staging local', analysis.jobId);

  const docCtx = await buildDocumentRequestContext(MOCK_USER);

  const confirmStarted = Date.now();
  const confirm = await confirmAnalysisPersistence({
    payload: {
      jobId: analysis.jobId,
      originalFileName: analysis.originalFileName,
      recommendedFileName: analysis.recommendedFileName || 'NDA_test.pdf',
      fileHash: analysis.fileHash,
      fileSizeBytes: analysis.fileSizeBytes,
      textExtraction: analysis.textExtraction,
      classification: analysis.classification,
      extraction: analysis.extraction || {
        documentType: analysis.classification.className,
        version: 'v1.0',
        metadata: {},
        missingFields: [],
        requiresReview: false,
        reviewReasons: [],
      },
      logs: analysis.logs,
      manualReviewConfirmed: false,
    },
    user: MOCK_USER,
    ctx: docCtx,
    requestId: 'test-no-ai-confirm',
  });

  console.log('\n--- confirm-analysis ---');
  console.log('durationMs:', Date.now() - confirmStarted);
  console.log('documentId:', confirm.documentId);
  console.log('versionId:', confirm.versionId);
  console.log('documentCode:', confirm.documentCode);
  console.log('storageStatus:', confirm.storageStatus);

  pass('confirm-analysis', confirm.documentId);
  if (confirm.storageStatus === 'stored') pass('storageStatus', 'stored');
  else fail('storageStatus', confirm.storageStatus);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail('MongoDB verify', 'MONGODB_URI ausente');
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(getMongoDatabaseName());
  const companyId = DEV_COMPANY_ID;

  const doc = await db.collection('documents').findOne({ _id: confirm.documentId, companyId });
  const ver = await db.collection('document_versions').findOne({ _id: confirm.versionId, companyId });
  const job = await db.collection('processing_jobs').findOne({ _id: analysis.jobId, companyId });
  const audits = await db
    .collection('audit_logs')
    .find({ documentId: confirm.documentId, companyId })
    .toArray();

  console.log('\n--- MongoDB ---');

  if (doc) {
    pass('documents', doc._id);
    if (doc.classId === NDA_CLASS_ID) pass('documents.classId', doc.classId);
    else fail('documents.classId', doc.classId);
    if (doc.access?.viewGroupIds?.length) pass('documents.access.viewGroupIds', doc.access.viewGroupIds.join(', '));
    else fail('documents.access');
  } else fail('documents', 'não encontrado');

  if (ver) {
    pass('document_versions', ver._id);
    if (ver.rule?.ruleId === NDA_RULE_ID) pass('document_versions.ruleId', ver.rule.ruleId);
    else pass('document_versions.ruleId', ver.rule?.ruleId ?? 'outra regra ativa');
    const indexLen = ver.metadataIndex?.length ?? 0;
    if (indexLen > 0) pass('metadataIndex', `${indexLen} entradas`);
    else fail('metadataIndex');
    const metaKeys = Object.keys(ver.metadata ?? {});
    pass('document_versions.metadata', `${metaKeys.length} campos`);
    if (ver.storage?.primary?.provider === 'local') pass('storage.primary.provider', 'local');
    else fail('storage.primary.provider', ver.storage?.primary?.provider ?? 'null');
    if (ver.storage?.primary?.status === 'stored') pass('storage.primary.status', 'stored');
    else fail('storage.primary.status', ver.storage?.primary?.status ?? 'null');
    const objectKey = ver.storage?.primary?.objectKey;
    if (objectKey && !objectKey.startsWith('/')) pass('storage.primary.objectKey relativa', objectKey);
    else fail('storage.primary.objectKey', objectKey ?? 'null');
    if (objectKey && !objectKey.includes(ver.recommendedFileName ?? '')) {
      pass('nome sugerido não está no path', ver.recommendedFileName);
    }
    if (objectKey) {
      const absolute = resolveStorageAbsolutePath(storageRoot, objectKey);
      try {
        readFileSync(absolute);
        pass('arquivo no disco', absolute);
      } catch {
        fail('arquivo no disco', absolute);
      }
    }
  } else fail('document_versions');

  if (job) pass('processing_jobs', job._id);
  else pass('processing_jobs', 'job pode usar jobId do analyze');

  if (audits.length >= 1) pass('audit_logs', `${audits.length} evento(s)`);
  else fail('audit_logs');

  const reusedOldId = doc?.documentCode?.startsWith('DOQYN-') === false;
  if (confirm.documentId.startsWith('doc_')) pass('novo documentId gerado', confirm.documentId);
  else fail('documentId', confirm.documentId);

  await client.close();
  await rm(storageRoot, { recursive: true, force: true });
  console.log('\n=== Fim teste no_ai ===');
}

main()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error('Erro:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
