/**
 * Etapa 5C — smoke test Groq (sem chamada à API).
 * Uso: npx tsx scripts/test-groq-smoke.mjs
 */
import 'dotenv/config';
import {
  getGroqClassifierModel,
  getGroqExtractorModel,
  getGroqModel,
  isGroqApiKeyConfigured,
} from '../server/ai/services/groqClient.ts';
import { loadActiveDocumentClassRules } from '../server/services/documentRulesService.ts';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { closeMongoConnection } from '../server/db/mongoClient.ts';

async function main() {
  console.log('=== Groq smoke (sem chamada) ===');
  console.log('GROQ_API_KEY present:', isGroqApiKeyConfigured());
  console.log('GROQ_MODEL:', getGroqModel());
  console.log('GROQ_CLASSIFIER_MODEL:', getGroqClassifierModel());
  console.log('GROQ_EXTRACTOR_MODEL:', getGroqExtractorModel());
  console.log('database:', getMongoDatabaseName());
  console.log('companyId:', DEV_COMPANY_ID);

  const rulesLoad = await loadActiveDocumentClassRules(DEV_COMPANY_ID);
  console.log('rules source:', rulesLoad.source);
  console.log('active classes:', rulesLoad.activeClassesCount);
  console.log('has NDA class:', rulesLoad.rules.some((c) => c.id === 'class_confidentiality_agreement'));
  console.log('OK — configuração válida para testes Groq.');
}

main()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error('Erro:', error instanceof Error ? error.message : error);
    await closeMongoConnection();
    process.exit(1);
  });
