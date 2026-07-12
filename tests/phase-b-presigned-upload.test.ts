import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Fase B.5 — presigned upload R2', () => {
  it('endpoint upload-url e rota registrada', () => {
    const apiServer = read('server/apiServer.ts');
    assert.ok(apiServer.includes("'/api/documents/upload-url'"));
    assert.ok(read('api/documents/upload-url.ts').includes('issueAnalysisStagingUploadUrl'));
  });

  it('módulo r2PresignedUrls usa getSignedUrl + PutObject', () => {
    const source = read('server/storage/r2/r2PresignedUrls.ts');
    assert.ok(source.includes('@aws-sdk/s3-request-presigner'));
    assert.ok(source.includes('getSignedUrl'));
    assert.ok(source.includes('buildAnalysisStagingKey'));
  });

  it('analyze-pdf aceita ingress staging e enfileira sem buffer', () => {
    const analyze = read('api/ai/analyze-pdf.ts');
    assert.ok(analyze.includes('parseAnalyzePdfRequest'));
    assert.ok(analyze.includes('resolveAnalyzePdfIngress'));
    assert.ok(analyze.includes('enqueuePdfAnalysisJobFromStaging'));
  });

  it('analyze-pdf-update suporta fluxo presigned', () => {
    const analyzeUpdate = read('api/ai/analyze-pdf-update.ts');
    assert.ok(analyzeUpdate.includes('enqueuePdfAnalysisJobFromStaging'));
    assert.ok(analyzeUpdate.includes('readDocumentIdFromIngress'));
  });

  it('frontend analyzePdf usa upload-url + PUT + JSON quando VITE flag ativa', () => {
    const frontend = read('src/features/document-send/services/analyzePdf.ts');
    assert.ok(frontend.includes('VITE_PRESIGNED_UPLOAD_ENABLED'));
    assert.ok(frontend.includes('/api/documents/upload-url'));
    assert.ok(frontend.includes('putFileToStagingUploadUrl'));
    assert.ok(frontend.includes('JSON.stringify'));
  });

  it('config presigned exige R2 e pode ser desligada por env', () => {
    const config = read('server/storage/presignedUploadConfig.ts');
    assert.ok(config.includes('PRESIGNED_UPLOAD_ENABLED'));
    assert.ok(config.includes('isR2StorageConfigured'));
    assert.ok(config.includes('PRESIGNED_UPLOAD_TTL_SECONDS'));
  });

  it('deploy produção habilita presigned por padrão', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.ok(setup.includes('PRESIGNED_UPLOAD_ENABLED=true'));
    assert.ok(setup.includes('VITE_PRESIGNED_UPLOAD_ENABLED=true'));
  });
});
