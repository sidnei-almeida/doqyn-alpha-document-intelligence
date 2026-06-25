/**
 * Testa classificação do PDF de NDA na raiz do projeto.
 * Uso: npx tsx scripts/test-nda-pdf.mjs
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionToken, getAuthCookieName } from '../server/auth/session.ts';
import { getTemporaryUser } from '../server/auth/tempUser.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const PDF_PATH = resolve(__dirname, '..', 'NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf');

async function main() {
  const user = getTemporaryUser();
  const cookie = `${getAuthCookieName()}=${await createSessionToken(user)}`;
  const pdf = readFileSync(PDF_PATH);
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'nda-teste.pdf');

  const res = await fetch(`${API_BASE}/api/ai/analyze-pdf`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`analyze-pdf (${res.status}): ${data.message}`);
  }

  console.log('status:', data.status);
  console.log('classe:', data.classification?.className, `(${data.classification?.classId})`);
  console.log('confiança:', data.classification?.confidence);
  console.log('nome sugerido:', data.recommendedFileName);
  console.log('requiresReview classificação:', data.classification?.requiresReview);
  console.log('requiresReview extração:', data.extraction?.requiresReview);
  if (data.extraction?.reviewReasons?.length) {
    console.log('motivos revisão:', data.extraction.reviewReasons.join(' | '));
  }
  if (data.extraction?.metadata?.parte_receptora) {
    console.log('parte receptora:', data.extraction.metadata.parte_receptora.value);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
