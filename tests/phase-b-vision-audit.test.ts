import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Auditoria B.7 — Vision OCR + pipeline debug + modelo Groq', () => {
  it('credenciais Vision estão fora do git e path documentado', () => {
    assert.equal(existsSync(join(ROOT, 'axial-entropy-499915-b5-047358a41e9d.json')), false);
    const gitignore = read('.gitignore');
    assert.ok(gitignore.includes('deploy/secrets') || gitignore.includes('gcp-*-sa.json'));
    const envExample = read('.env.example');
    assert.ok(envExample.includes('GOOGLE_APPLICATION_CREDENTIALS'));
    assert.ok(envExample.includes('AI_PIPELINE_DEBUG'));
  });

  it('pipelineDebug helper existe com tag removível', () => {
    const source = read('server/ai/utils/pipelineDebug.ts');
    assert.ok(source.includes('AI_PIPELINE_DEBUG'));
    assert.ok(source.includes('summarizeError'));
    assert.ok(source.includes('previewText'));
    assert.ok(source.includes('bufferMeta'));
    assert.ok(source.includes('TEMPORÁRIO') || source.includes('temporário') || source.includes('Desligar'));
  });

  it('OCR / extractor / groq / worker emitem logs AI_PIPELINE_DEBUG', () => {
    assert.ok(read('server/ai/vision/visionOcrService.ts').includes('pipelineInfo'));
    assert.ok(read('server/ai/services/documentTextExtractor.ts').includes('pipelineInfo'));
    assert.ok(read('server/ai/services/pdfTextExtractor.ts').includes('pipelineInfo'));
    assert.ok(read('server/ai/services/groqClient.ts').includes('pipelineError'));
    assert.ok(read('server/ai/services/analyzePdfService.ts').includes('JOB INÍCIO'));
    assert.ok(read('server/workers/analysisWorker.ts').includes('pipelineError'));
  });

  it('cascata Vision só após pdf-parse insuficiente', () => {
    const extractor = read('server/ai/services/documentTextExtractor.ts');
    assert.ok(extractor.includes('extractTextFromPdf'));
    assert.ok(extractor.includes('getVisionOcrMinTextChars'));
    assert.ok(extractor.includes('ocrPdfPages'));
    assert.ok(extractor.includes('Vision NÃO chamado') || extractor.includes('ocrFallbackUsed: false'));
  });

  it('.env.example documenta os modelos Groq em produção hoje', () => {
    const env = read('.env.example');
    // A recomendação era Llama 4 Scout; a família llama-3.1-8b foi descontinuada pela Groq em
    // 17/06/2026 e os gpt-oss passaram a ser os modelos de produção com cache de prompt.
    assert.ok(env.includes('GROQ_MODEL=openai/gpt-oss-120b'));
    assert.ok(env.includes('openai/gpt-oss-20b'));
  });

  it('health visionOcr não quebra status quando OCR desligado', async () => {
    const original = process.env.VISION_OCR_ENABLED;
    process.env.VISION_OCR_ENABLED = 'false';
    try {
      const { resolveOverallStatus } = await import('../server/health/deepHealthCheck.js');
      const status = resolveOverallStatus({
        mongo: { ok: true },
        redis: { ok: true },
        r2: { ok: true, configured: true },
        auth: { ok: true },
        analysisQueue: { ok: true },
        previewQueue: { ok: true },
        aiProvider: { ok: true, name: 'groq', configured: true },
        visionOcr: { ok: true, enabled: false, configured: false, name: 'google_vision' },
      });
      assert.equal(status, 'ok');
    } finally {
      if (original === undefined) delete process.env.VISION_OCR_ENABLED;
      else process.env.VISION_OCR_ENABLED = original;
    }
  });

  it('módulos Vision importam sem erro', async () => {
    const config = await import('../server/ai/vision/visionConfig.js');
    assert.equal(typeof config.isVisionOcrEnabled, 'function');
    assert.equal(typeof config.getVisionOcrHealth, 'function');
    const ocr = await import('../server/ai/vision/visionOcrService.js');
    assert.equal(typeof ocr.ocrImageBuffer, 'function');
    assert.equal(typeof ocr.ocrPdfPages, 'function');
    const debug = await import('../server/ai/utils/pipelineDebug.js');
    assert.equal(typeof debug.pipelineDebug, 'function');
  });
});
