import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzePdfBuffer } from '../server/ai/services/analyzePdfService.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';
import { diagnoseClassAndRuleLookup } from '../server/services/documentRulesService.ts';
import { closeMongoConnection } from '../server/db/mongoClient.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = resolve(__dirname, '..', 'NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf');

async function main() {
  const buf = readFileSync(PDF_PATH);
  const startedAt = Date.now();
  const result = await analyzePdfBuffer({
    buffer: buf,
    originalFileName: 'nda-teste.pdf',
    mimeType: 'application/pdf',
    companyId: DEV_COMPANY_ID,
    requestContext: { requestId: 'test-direct' },
  });

  console.log('analyze durationMs:', Date.now() - startedAt);
  console.log('status:', result.status);
  console.log('class:', result.classification.className, result.classification.classId);
  console.log('confidence:', result.classification.confidence);
  console.log('textCharCount:', result.textExtraction.charCount);

  if (result.classification.classId) {
    const diag = await diagnoseClassAndRuleLookup({
      companyId: DEV_COMPANY_ID,
      classId: result.classification.classId,
      className: result.classification.className,
    });
    console.log('confirm lookup:', diag);
  }
}

main()
  .then(() => closeMongoConnection())
  .catch(async (error) => {
    console.error(error);
    await closeMongoConnection();
    process.exit(1);
  });
