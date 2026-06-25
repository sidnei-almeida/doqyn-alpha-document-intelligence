/**
 * Etapa 5C — teste fixture curta do classificador (1 chamada Groq).
 * Uso: npx tsx scripts/test-groq-fixture.mjs
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  getGroqClassifierModel,
  isGroqApiKeyConfigured,
} from '../server/ai/services/groqClient.ts';
import { classifyDocumentWithRules } from '../server/ai/services/documentClassifierAgent.ts';
import { loadActiveDocumentClassRules } from '../server/services/documentRulesService.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { closeMongoConnection } from '../server/db/mongoClient.ts';

const NDA_FIXTURE =
  'ACORDO DE CONFIDENCIALIDADE. As partes reconhecem informações confidenciais. ' +
  'A PARTE RECEPTORA se compromete a não divulgar informações recebidas da PARTE REVELADORA. ' +
  'NDA. Não divulgação. Sigilo comercial.';

function chunkFromText(text) {
  return [
    {
      pageNumber: 1,
      chunkIndex: 0,
      text,
      score: 100,
      matchedTerms: ['confidencialidade', 'nda'],
      reason: 'fixture',
    },
  ];
}

async function main() {
  if (!isGroqApiKeyConfigured()) {
    console.error('GROQ_API_KEY ausente — abortando.');
    process.exit(1);
  }

  console.log('=== Groq fixture ===');
  console.log('classifierModel:', getGroqClassifierModel());

  const rulesLoad = await loadActiveDocumentClassRules(DEV_COMPANY_ID);
  const context = {
    requestId: `test-fixture-${randomUUID().slice(0, 8)}`,
    jobId: `job_test_${Date.now()}`,
    companyId: DEV_COMPANY_ID,
    database: getMongoDatabaseName(),
  };

  const startedAt = Date.now();
  const result = await classifyDocumentWithRules({
    chunks: chunkFromText(NDA_FIXTURE),
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
