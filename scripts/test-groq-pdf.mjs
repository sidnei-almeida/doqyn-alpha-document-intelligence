/**
 * Etapa 5C — teste PDF real do classificador (1 chamada Groq).
 * Uso: npx tsx scripts/test-groq-pdf.mjs
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getGroqClassifierModel,
  isGroqApiKeyConfigured,
} from '../server/ai/services/groqClient.ts';
import { classifyDocumentWithRules } from '../server/ai/services/documentClassifierAgent.ts';
import { loadActiveDocumentClassRules } from '../server/services/documentRulesService.ts';
import { createDocumentChunks } from '../server/ai/services/documentChunker.ts';
import { selectChunksForClassification } from '../server/services/retrievalProvider.ts';
import { extractTextFromPdf } from '../server/ai/services/pdfTextExtractor.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { closeMongoConnection } from '../server/db/mongoClient.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_NDA = resolve(__dirname, '..', 'NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf');

async function main() {
  if (!isGroqApiKeyConfigured()) {
    console.error('GROQ_API_KEY ausente — abortando.');
    process.exit(1);
  }

  console.log('=== Groq PDF NDA ===');
  console.log('classifierModel:', getGroqClassifierModel());

  const rulesLoad = await loadActiveDocumentClassRules(DEV_COMPANY_ID);
  const context = {
    requestId: `test-pdf-${randomUUID().slice(0, 8)}`,
    jobId: `job_test_${Date.now()}`,
    companyId: DEV_COMPANY_ID,
    database: getMongoDatabaseName(),
  };

  const pdfBuffer = readFileSync(PDF_NDA);
  const extracted = await extractTextFromPdf(pdfBuffer);
  const chunks = createDocumentChunks(extracted);
  const classChunks = selectChunksForClassification({
    chunks,
    classes: rulesLoad.rules,
  });

  console.log('textCharCount:', extracted.charCount);
  console.log('pageCount:', extracted.pageCount);
  console.log('classificationChunks:', classChunks.length);
  console.log(
    'totalContextChars:',
    classChunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
  );

  const startedAt = Date.now();
  const result = await classifyDocumentWithRules({
    chunks: classChunks,
    classes: rulesLoad.rules,
    context,
  });

  console.log('durationMs:', Date.now() - startedAt);
  console.log('classId:', result.classId);
  console.log('className:', result.className);
  console.log('confidence:', result.confidence);
  console.log('requiresReview:', result.requiresReview);
  console.log('errorCode:', result.errorCode ?? '—');
  console.log('reason:', result.reason);

  const ok =
    result.classId === 'class_confidentiality_agreement' &&
    !result.requiresReview &&
    !result.errorCode;

  console.log('result:', ok ? 'PASS' : result.errorCode === 'GROQ_RATE_LIMIT' ? 'RATE_LIMIT' : 'FAIL/REVIEW');
  process.exitCode = ok ? 0 : result.errorCode === 'GROQ_RATE_LIMIT' ? 2 : 1;
}

main()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error('Erro:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
