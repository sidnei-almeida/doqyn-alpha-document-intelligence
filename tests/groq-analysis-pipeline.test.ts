import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { DEFAULT_GROQ_MODEL, getExtractionMaxChunks, getGroqMaxOutputTokens, getGroqModelFromEnv, getPdfAnalysisMaxInputChars, getPdfAnalysisMaxPages } from '../server/ai/utils/aiConfig.js';
import { AI_ERROR_MESSAGES } from '../server/ai/constants.js';
import { isGroqApiKeyConfigured } from '../server/ai/services/groqClient.js';
import { AiAnalysisError } from '../server/ai/utils/errors.js';
import { assertAiProviderConfigured } from '../server/ai/utils/aiProvider.js';
import { workflowErrorFromUnknown } from '../server/utils/workflowErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function readServer(relativePath: string): string {
  return readFileSync(join(repoRoot, 'server', relativePath), 'utf8');
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function readApi(relativePath: string): string {
  return readFileSync(join(repoRoot, 'api', relativePath), 'utf8');
}

describe('pipeline Groq — remoção de no_ai', () => {
  it('D. noAiAnalyzer foi removido e analyzePdfService não importa no_ai', () => {
    assert.equal(existsSync(join(repoRoot, 'server/ai/services/noAiAnalyzer.ts')), false);
    assert.equal(existsSync(join(repoRoot, 'server/ai/utils/aiMode.ts')), false);

    const analyze = readServer('ai/services/analyzePdfService.ts');
    assert.equal(analyze.includes('noAiAnalyzer'), false);
    assert.equal(analyze.includes('isNoAiMode'), false);
    assert.equal(analyze.includes('analyzePdfWithNoAi'), false);
    assert.ok(analyze.includes('assertAiProviderConfigured'));
    assert.ok(analyze.includes('resolveAnalysisProvider'));
    assert.ok(analyze.includes('analysisProvider.classify'));
  });

  it('A. sem GROQ_API_KEY assertAiProviderConfigured lança AI_PROVIDER_NOT_CONFIGURED', () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      assert.equal(isGroqApiKeyConfigured(), false);
      assert.throws(
        () => assertAiProviderConfigured(),
        (error: AiAnalysisError) => {
          assert.equal(error.code, 'AI_PROVIDER_NOT_CONFIGURED');
          assert.match(error.message, /GROQ_API_KEY/i);
          return true;
        },
      );

      const mapped = workflowErrorFromUnknown(
        new AiAnalysisError(AI_ERROR_MESSAGES.aiProviderNotConfigured, 'AI_PROVIDER_NOT_CONFIGURED', 503),
      );
      assert.equal(mapped.body.code, 'AI_PROVIDER_NOT_CONFIGURED');
      assert.match(mapped.body.message, /GROQ_API_KEY/i);
    } finally {
      if (original !== undefined) {
        process.env.GROQ_API_KEY = original;
      }
    }
  });

  it('B. default GROQ_MODEL é llama-3.1-8b-instant', () => {
    const original = process.env.GROQ_MODEL;
    delete process.env.GROQ_MODEL;

    try {
      assert.equal(DEFAULT_GROQ_MODEL, 'llama-3.1-8b-instant');
      assert.equal(getGroqModelFromEnv(), 'llama-3.1-8b-instant');
    } finally {
      if (original !== undefined) {
        process.env.GROQ_MODEL = original;
      }
    }
  });

  it('B. groqClient aplica max_tokens e temperatura baixa', () => {
    const groq = readServer('ai/services/groqClient.ts');
    assert.ok(groq.includes('max_tokens: getGroqMaxOutputTokens()'));
    assert.ok(groq.includes('temperature: 0.1'));
    assert.ok(groq.includes("response_format: { type: 'json_object'"));
    assert.equal(getGroqMaxOutputTokens(), 1200);
  });

  it('guardrails de custo — limites PDF configuráveis', () => {
    // Defaults dimensionados para a janela de 131k tokens do llama-4-scout.
    // No plano gratuito da Groq (6k TPM), baixe via env ou a análise dá 429.
    assert.equal(getPdfAnalysisMaxInputChars(), 300_000);
    assert.equal(getPdfAnalysisMaxPages(), 100);
    assert.equal(getExtractionMaxChunks(), 40);

    const extractor = readServer('ai/services/pdfTextExtractor.ts');
    assert.ok(extractor.includes('getPdfAnalysisMaxInputChars'));
    assert.ok(extractor.includes('getPdfAnalysisMaxPages'));
    assert.ok(extractor.includes('truncated for cost guardrails'));
  });

  it('guardrails de custo — env sobrescreve os defaults', () => {
    const previous = {
      chars: process.env.PDF_ANALYSIS_MAX_INPUT_CHARS,
      pages: process.env.PDF_ANALYSIS_MAX_PAGES,
      chunks: process.env.EXTRACTION_MAX_CHUNKS,
    };
    try {
      process.env.PDF_ANALYSIS_MAX_INPUT_CHARS = '30000';
      process.env.PDF_ANALYSIS_MAX_PAGES = '10';
      process.env.EXTRACTION_MAX_CHUNKS = '8';
      assert.equal(getPdfAnalysisMaxInputChars(), 30_000);
      assert.equal(getPdfAnalysisMaxPages(), 10);
      assert.equal(getExtractionMaxChunks(), 8);
    } finally {
      restoreEnv('PDF_ANALYSIS_MAX_INPUT_CHARS', previous.chars);
      restoreEnv('PDF_ANALYSIS_MAX_PAGES', previous.pages);
      restoreEnv('EXTRACTION_MAX_CHUNKS', previous.chunks);
    }
  });

  it('C. pipeline continua tenant-based sem mock global', () => {
    const rules = readServer('services/documentRulesService.ts');
    assert.ok(rules.includes('isAllowMockRulesEnabled'));
    assert.ok(rules.includes('loadFromGovernanceCollections'));
    assert.equal(rules.includes('companyId: string = DEV_TENANT_ID'), false);
  });

  it('analyze-pdf não envia tenantId do body e usa Groq', () => {
    const endpoint = readApi('ai/analyze-pdf.ts');
    assert.equal(endpoint.includes('req.body.tenantId'), false);
    assert.ok(endpoint.includes('getCompanyIdFromUser(user)'));
    assert.ok(endpoint.includes('resolveAnalysisProviderName'));
    assert.equal(endpoint.includes('AI_MODE'), false);
  });

  it('E. parsing JSON usa safeParse e erros controlados', () => {
    const classifier = readServer('ai/services/documentClassifierAgent.ts');
    const extractor = readServer('ai/services/metadataExtractorAgent.ts');
    assert.ok(classifier.includes('safeParseJsonFromModel'));
    assert.ok(classifier.includes('validateClassificationResult'));
    assert.ok(extractor.includes('safeParseJsonFromModel'));
    assert.ok(extractor.includes('validateMetadataResult'));
  });

  it('.env.example documenta Groq sem AI_MODE=no_ai', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    assert.ok(envExample.includes('GROQ_API_KEY='));
    assert.ok(envExample.includes('GROQ_MODEL=llama-3.1-8b-instant'));
    assert.ok(envExample.includes('GROQ_MAX_OUTPUT_TOKENS=1200'));
    assert.ok(envExample.includes('PDF_ANALYSIS_MAX_INPUT_CHARS=30000'));
    assert.equal(envExample.includes('AI_MODE=no_ai'), false);
    assert.equal(envExample.includes('NO_AI_TEMPLATE'), false);
  });
});
