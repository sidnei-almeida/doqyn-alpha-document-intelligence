import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.9 — upload e análise de imagens', () => {
  it('constants aceitam JPG/PNG/WebP', () => {
    const source = read('server/ai/constants.ts');
    assert.match(source, /image\/jpeg/);
    assert.match(source, /image\/png/);
    assert.match(source, /image\/webp/);
    assert.match(source, /resolveAnalysisMimeType/);
  });

  it('UI uploadConstants aceita imagens', () => {
    const source = read('src/features/document-send/uploadConstants.ts');
    assert.match(source, /image\/jpeg/);
    assert.match(source, /UPLOAD_ACCEPT/);
    assert.match(source, /JPG, PNG ou WebP/);
  });

  it('staging aceita imagem', () => {
    const source = read('server/services/analysis/analysisStagingUploadService.ts');
    assert.match(source, /resolveAnalysisMimeType/);
    assert.match(source, /UNSUPPORTED_FORMAT/);
    assert.doesNotMatch(source, /assertPdfUpload/);
  });

  it('pipeline analisa image/* via extractTextFromDocument', () => {
    const helpers = read('server/ai/services/pdfAnalysisHelpers.ts');
    assert.match(helpers, /validateAnalysisUpload/);

    const extractor = read('server/ai/services/documentTextExtractor.ts');
    assert.match(extractor, /extractTextFromDocumentImage/);
    assert.match(extractor, /extractTextFromDocument\(/);

    const analyze = read('server/ai/services/analyzePdfService.ts');
    assert.match(analyze, /extractTextFromDocument\(/);
    assert.match(analyze, /validateAnalysisUpload/);
  });

  it('confirm usa mime dinâmico', () => {
    const shared = read('server/services/confirm/confirmVersionShared.ts');
    assert.match(shared, /mimeType\?: string/);

    const confirm = read('server/services/confirmAnalysisService.ts');
    assert.match(confirm, /contentMimeType/);
    assert.match(confirm, /mimeType: z\.string/);
  });

  it('assinatura continua PDF-only (regressão)', () => {
    const promote = read(
      'server/services/signatures/promoteSignedPdfToDocumentVersion.ts',
    );
    assert.match(promote, /application\/pdf|pdf/i);

    const signatureTest = read('tests/document-signature.test.ts');
    assert.match(signatureTest, /pdf|assinatura/i);
  });

  it('extractTextFromDocumentImage marca falha sem Vision', async () => {
    delete process.env.VISION_OCR_ENABLED;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const { extractTextFromDocumentImage, isVisionOcrFailure } = await import(
      '../server/ai/services/documentTextExtractor.js'
    ).then(async (mod) => {
      const review = await import('../server/ai/services/visionOcrFailureReview.js');
      return { ...mod, isVisionOcrFailure: review.isVisionOcrFailure };
    });

    const result = await extractTextFromDocumentImage(Buffer.from('fake-image'));
    assert.equal(result.source, 'google_vision');
    assert.equal(result.ocrErrorCode, 'VISION_OCR_FAILED');
    assert.equal(isVisionOcrFailure(result), true);
  });
});
