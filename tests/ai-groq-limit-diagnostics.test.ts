import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnoseClassifierError } from '../server/ai/utils/classifierDiagnostics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('diagnóstico de limites Groq', () => {
  it('detecta cota diária de tokens (TPD)', () => {
    const diagnostic = diagnoseClassifierError({
      status: 429,
      message:
        'Rate limit reached for model `llama-3.3-70b-versatile` on tokens per day (TPD): Limit 100000, Used 98881',
    });
    assert.equal(diagnostic.code, 'GROQ_DAILY_TOKEN_LIMIT');
  });

  it('detecta rate limit por minuto (429 genérico)', () => {
    const diagnostic = diagnoseClassifierError({
      status: 429,
      message: 'Rate limit exceeded',
    });
    assert.equal(diagnostic.code, 'GROQ_RATE_LIMIT');
  });

  it('analyzePdfService retorna ai_unavailable sem fallback heurístico', () => {
    const source = read('server/ai/services/analyzePdfService.ts');
    assert.ok(source.includes("status: 'ai_unavailable'"));
    assert.ok(!source.includes('classifyDocumentHeuristically'));
    assert.ok(source.includes('GROQ_DAILY_TOKEN_LIMIT'));
  });

  it('groq client faz múltiplas tentativas em rate limit', () => {
    const groq = read('server/ai/services/groqClient.ts');
    assert.ok(groq.includes('RATE_LIMIT_RETRY_DELAYS_MS'));
    assert.ok(groq.includes('GROQ_DAILY_TOKEN_LIMIT'));
  });
});
