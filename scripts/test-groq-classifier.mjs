/**
 * Etapa 5C — teste isolado do classificador Groq.
 * Por padrão roda apenas fixture (baixa carga). Use GROQ_TEST_MODE=pdf para PDF.
 * Uso: npx tsx scripts/test-groq-classifier.mjs
 */
import 'dotenv/config';

const mode = process.env.GROQ_TEST_MODE?.trim() || 'fixture';

if (mode === 'pdf') {
  await import('./test-groq-pdf.mjs');
} else if (mode === 'smoke') {
  await import('./test-groq-smoke.mjs');
} else {
  await import('./test-groq-fixture.mjs');
}
