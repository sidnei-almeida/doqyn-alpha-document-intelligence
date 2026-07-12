import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.7 — Vision OCR foundation', () => {
  it('package.json inclui @google-cloud/vision', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    assert.ok(pkg.dependencies?.['@google-cloud/vision']);
  });

  it('.env.example documenta VISION_OCR e GOOGLE_APPLICATION_CREDENTIALS', () => {
    const env = read('.env.example');
    assert.ok(env.includes('VISION_OCR_ENABLED'));
    assert.ok(env.includes('GOOGLE_APPLICATION_CREDENTIALS'));
    assert.ok(env.includes('deploy/secrets/gcp-vision-sa.json'));
  });

  it('JSON de service account não está na raiz do repo', () => {
    assert.equal(existsSync(join(ROOT, 'axial-entropy-499915-b5-047358a41e9d.json')), false);
  });

  it('.gitignore cobre service accounts GCP', () => {
    const gitignore = read('.gitignore');
    assert.ok(gitignore.includes('**/gcp-*-sa.json') || gitignore.includes('gcp-*-sa.json'));
    assert.ok(gitignore.includes('deploy/secrets'));
  });

  it('módulos visionConfig / visionOcrService / documentTextExtractor existem', () => {
    const config = read('server/ai/vision/visionConfig.ts');
    assert.ok(config.includes('isVisionOcrEnabled'));
    assert.ok(config.includes('resolveGoogleCredentialsPath'));
    assert.ok(config.includes('getVisionOcrHealth'));

    const ocr = read('server/ai/vision/visionOcrService.ts');
    assert.ok(ocr.includes('ocrImageBuffer'));
    assert.ok(ocr.includes('ocrPdfPages'));
    assert.ok(ocr.includes('documentTextDetection'));

    const extractor = read('server/ai/services/documentTextExtractor.ts');
    assert.ok(extractor.includes('extractTextFromDocumentPdf'));
    assert.ok(extractor.includes('ocrFallbackUsed'));
    assert.ok(extractor.includes('ocrPdfPages'));
  });

  it('analyzePdfService e update usam documentTextExtractor', () => {
    const analyze = read('server/ai/services/analyzePdfService.ts');
    assert.ok(analyze.includes('extractTextFromDocumentPdf'));
    assert.equal(analyze.includes("from './pdfTextExtractor.js'"), false);

    const update = read('server/ai/services/analyzePdfUpdateService.ts');
    assert.ok(update.includes('extractTextFromDocumentPdf'));
  });

  it('deep health inclui visionOcr', () => {
    const health = read('server/health/deepHealthCheck.ts');
    assert.ok(health.includes('visionOcr'));
    assert.ok(health.includes('getVisionOcrHealth'));
    assert.ok(health.includes('checkVisionOcr'));
  });

  it('visionConfig respeita VISION_OCR_ENABLED=false por padrão', async () => {
    const original = process.env.VISION_OCR_ENABLED;
    delete process.env.VISION_OCR_ENABLED;
    try {
      const { isVisionOcrEnabled, getVisionOcrHealth } = await import(
        '../server/ai/vision/visionConfig.js'
      );
      assert.equal(isVisionOcrEnabled(), false);
      const health = getVisionOcrHealth();
      assert.equal(health.enabled, false);
      assert.equal(health.configured, false);
    } finally {
      if (original === undefined) delete process.env.VISION_OCR_ENABLED;
      else process.env.VISION_OCR_ENABLED = original;
    }
  });

  it('resolveGoogleCredentialsPath encontra SA em deploy/secrets quando configurado', async () => {
    const originalCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const originalEnabled = process.env.VISION_OCR_ENABLED;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = './deploy/secrets/gcp-vision-sa.json';
    process.env.VISION_OCR_ENABLED = 'true';
    try {
      const { resolveGoogleCredentialsPath, isVisionOcrConfigured, getVisionOcrHealth } =
        await import('../server/ai/vision/visionConfig.js');
      const path = resolveGoogleCredentialsPath();
      if (existsSync(join(ROOT, 'deploy/secrets/gcp-vision-sa.json'))) {
        assert.ok(path);
        assert.ok(path!.endsWith('gcp-vision-sa.json'));
        assert.equal(isVisionOcrConfigured(), true);
        assert.equal(getVisionOcrHealth().configured, true);
      } else {
        assert.equal(path, null);
      }
    } finally {
      if (originalCreds === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      else process.env.GOOGLE_APPLICATION_CREDENTIALS = originalCreds;
      if (originalEnabled === undefined) delete process.env.VISION_OCR_ENABLED;
      else process.env.VISION_OCR_ENABLED = originalEnabled;
    }
  });
});
