import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('Fase B.8 — cascata OCR e controle de custo', () => {
  const envKeys = [
    'VISION_OCR_ENABLED',
    'VISION_OCR_MIN_TEXT_CHARS',
    'VISION_OCR_MAX_PAGES',
    'PDF_ANALYSIS_MAX_PAGES',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'METRICS_ENABLED',
  ];

  afterEach(() => {
    for (const key of envKeys) delete process.env[key];
  });

  it('shouldAttemptVisionOcr só dispara abaixo do threshold com Vision pronto', async () => {
    const { shouldAttemptVisionOcr } = await import(
      '../server/ai/services/documentTextExtractor.js'
    );

    assert.equal(
      shouldAttemptVisionOcr({
        charCount: 500,
        minChars: 300,
        enabled: true,
        configured: true,
      }),
      false,
    );
    assert.equal(
      shouldAttemptVisionOcr({
        charCount: 100,
        minChars: 300,
        enabled: true,
        configured: true,
      }),
      true,
    );
    assert.equal(
      shouldAttemptVisionOcr({
        charCount: 100,
        minChars: 300,
        enabled: false,
        configured: true,
      }),
      false,
    );
    assert.equal(
      shouldAttemptVisionOcr({
        charCount: 100,
        minChars: 300,
        enabled: true,
        configured: false,
      }),
      false,
    );
  });

  it('resolveVisionOcrPageLimit respeita VISION_OCR_MAX_PAGES', async () => {
    process.env.VISION_OCR_MAX_PAGES = '3';
    process.env.PDF_ANALYSIS_MAX_PAGES = '10';
    const { resolveVisionOcrPageLimit } = await import(
      '../server/ai/services/documentTextExtractor.js'
    );

    assert.equal(resolveVisionOcrPageLimit({ pageCountHint: 50 }), 3);
    assert.equal(resolveVisionOcrPageLimit({ pageCountHint: 2 }), 2);
  });

  it('PDF digital com texto suficiente NÃO chama Vision', async () => {
    process.env.VISION_OCR_ENABLED = 'true';
    process.env.VISION_OCR_MIN_TEXT_CHARS = '50';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/fake-does-not-matter.json';

    let ocrCalls = 0;
    const { extractTextFromDocumentPdf } = await import(
      '../server/ai/services/documentTextExtractor.js'
    );

    const result = await extractTextFromDocumentPdf(Buffer.from('%PDF-fake'), {
      extractNative: async () => ({
        text: 'x'.repeat(200),
        pages: [{ pageNumber: 1, text: 'x'.repeat(200) }],
        pageCount: 1,
        charCount: 200,
        truncated: false,
      }),
      ocrPdf: async () => {
        ocrCalls += 1;
        throw new Error('não deveria chamar OCR');
      },
    });

    assert.equal(ocrCalls, 0);
    assert.equal(result.ocrFallbackUsed, false);
    assert.equal(result.ocrAttempted, false);
    assert.equal(result.source, 'pdf_parse');
  });

  it('limite de páginas é passado ao OCR', async () => {
    const snapshot = {
      VISION_OCR_ENABLED: process.env.VISION_OCR_ENABLED,
      VISION_OCR_MIN_TEXT_CHARS: process.env.VISION_OCR_MIN_TEXT_CHARS,
      VISION_OCR_MAX_PAGES: process.env.VISION_OCR_MAX_PAGES,
      PDF_ANALYSIS_MAX_PAGES: process.env.PDF_ANALYSIS_MAX_PAGES,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };

    process.env.VISION_OCR_ENABLED = 'true';
    process.env.VISION_OCR_MIN_TEXT_CHARS = '300';
    process.env.VISION_OCR_MAX_PAGES = '2';
    process.env.PDF_ANALYSIS_MAX_PAGES = '10';

    const { writeFileSync, mkdirSync } = await import('node:fs');
    const credsPath = join(ROOT, 'deploy/secrets/.test-vision-sa.json');
    mkdirSync(join(ROOT, 'deploy/secrets'), { recursive: true });
    writeFileSync(credsPath, JSON.stringify({ type: 'service_account', client_email: 't@t' }));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;

    try {
      let receivedMaxPages: number | undefined;
      const { extractTextFromDocumentPdf } = await import(
        '../server/ai/services/documentTextExtractor.js'
      );

      const result = await extractTextFromDocumentPdf(Buffer.from('%PDF-scan'), {
        extractNative: async () => ({
          text: 'a',
          pages: [{ pageNumber: 1, text: 'a' }],
          pageCount: 8,
          charCount: 1,
          truncated: false,
        }),
        ocrPdf: async (_buf, options) => {
          receivedMaxPages = options?.maxPages;
          return {
            text: 'ocr '.repeat(100),
            pages: [
              { pageNumber: 1, text: 'ocr page 1' },
              { pageNumber: 2, text: 'ocr page 2' },
            ],
            pageCount: 8,
            charCount: 400,
            truncated: true,
            provider: 'google_vision' as const,
            pagesProcessed: 2,
            durationMs: 42,
          };
        },
      });

      assert.equal(receivedMaxPages, 2);
      assert.equal(result.ocrFallbackUsed, true);
      assert.equal(result.ocrPagesProcessed, 2);
      assert.equal(result.ocrDurationMs, 42);
      assert.ok(result.source.includes('google_vision'));
    } finally {
      restoreEnv(snapshot);
      try {
        const { unlinkSync } = await import('node:fs');
        unlinkSync(credsPath);
      } catch {
        /* ignore */
      }
    }
  });

  it('falha Vision → VISION_OCR_FAILED (requires_review helper, não crash)', async () => {
    const snapshot = {
      VISION_OCR_ENABLED: process.env.VISION_OCR_ENABLED,
      VISION_OCR_MIN_TEXT_CHARS: process.env.VISION_OCR_MIN_TEXT_CHARS,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };

    process.env.VISION_OCR_ENABLED = 'true';
    process.env.VISION_OCR_MIN_TEXT_CHARS = '300';

    const { writeFileSync, mkdirSync, unlinkSync } = await import('node:fs');
    const credsPath = join(ROOT, 'deploy/secrets/.test-vision-fail-sa.json');
    mkdirSync(join(ROOT, 'deploy/secrets'), { recursive: true });
    writeFileSync(credsPath, JSON.stringify({ type: 'service_account' }));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;

    try {
      const { extractTextFromDocumentPdf } = await import(
        '../server/ai/services/documentTextExtractor.js'
      );
      const { buildVisionOcrFailedReviewResponse, isVisionOcrFailure } = await import(
        '../server/ai/services/visionOcrFailureReview.js'
      );

      const extracted = await extractTextFromDocumentPdf(Buffer.from('%PDF-fail'), {
        extractNative: async () => ({
          text: '',
          pages: [{ pageNumber: 1, text: '' }],
          pageCount: 1,
          charCount: 0,
          truncated: false,
        }),
        ocrPdf: async () => {
          throw new Error('Vision API unavailable');
        },
      });

      assert.equal(extracted.ocrAttempted, true);
      assert.equal(extracted.ocrErrorCode, 'VISION_OCR_FAILED');
      assert.equal(isVisionOcrFailure(extracted), true);

      const review = buildVisionOcrFailedReviewResponse({
        jobId: 'job_test',
        originalFileName: 'scan.pdf',
        fileHash: 'abc',
        fileSizeBytes: 10,
        extracted,
        logs: [],
      });

      assert.equal(review.status, 'requires_review');
      assert.equal(review.errorCode, 'VISION_OCR_FAILED');
      assert.equal(review.classification.requiresReview, true);
      assert.equal(review.extraction, null);
    } finally {
      restoreEnv(snapshot);
      try {
        unlinkSync(credsPath);
      } catch {
        /* ignore */
      }
    }
  });

  it('métricas Vision estão registradas no prometheus', () => {
    const source = read('server/metrics/prometheus.ts');
    assert.match(source, /doqyn_vision_ocr_requests_total/);
    assert.match(source, /doqyn_vision_ocr_pages_total/);
    assert.match(source, /doqyn_vision_ocr_failures_total/);
    assert.match(source, /recordVisionOcrRequest/);
  });

  it('compose monta secrets GCP em api e worker', () => {
    const compose = read('deploy/docker-compose.production.yml');
    assert.match(compose, /\.\/secrets:\/run\/secrets:ro/);
    assert.ok(compose.includes('doqyn-api:'));
    assert.ok(compose.includes('doqyn-worker:'));
  });

  it('setup-production-env gera vars Vision desligadas por padrão', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.match(setup, /VISION_OCR_ENABLED=false/);
    assert.match(setup, /GOOGLE_APPLICATION_CREDENTIALS=\/run\/secrets\/gcp-vision-sa\.json/);
  });

  it('bulkFileValidation reconhece VISION_OCR_FAILED', () => {
    const source = read('src/features/document-send/utils/bulkFileValidation.ts');
    assert.match(source, /VISION_OCR_FAILED/);
  });
});
