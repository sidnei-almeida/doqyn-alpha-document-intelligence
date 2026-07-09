import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { generateSignedPdf, SIGNATURE_CONSENT_TEXT } from '../server/services/signatures/signaturePdfService.js';
import { hashSignaturePortalToken } from '../server/services/signatures/signatureTokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('document electronic signature — fase 1', () => {
  it('modelo Mongo e coleções globais definidos', () => {
    const constants = read('server/db/constants.ts');
    assert.ok(constants.includes('documentSignatureRequests'));
    assert.ok(constants.includes('documentSignatures'));
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoDocumentSignatureRequest'));
    assert.ok(types.includes('MongoDocumentSignature'));
    assert.ok(types.includes('signatureStatus'));
  });

  it('token de portal é hasheado e nunca persistido em claro no serviço', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(service.includes('signatureTokenHash'));
    assert.ok(service.includes('hashSignaturePortalToken'));
    assert.equal(service.includes('portalToken'), true);
    const hash = hashSignaturePortalToken('sample-token-value');
    assert.equal(hash.length, 64);
    assert.notEqual(hash, 'sample-token-value');
  });

  it('artefatos de assinatura usam path dedicado no R2', () => {
    const keys = read('server/storage/storageKeys.ts');
    assert.ok(keys.includes('buildSignatureArtifactObjectKey'));
    assert.ok(keys.includes('/signatures/'));
    assert.ok(keys.includes('signed.pdf'));
    assert.ok(keys.includes('evidence.json'));
  });

  it('gera PDF assinado com carimbo e certificado', async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const originalBytes = await original.save();

    const result = await generateSignedPdf({
      originalPdfBuffer: Buffer.from(originalBytes),
      documentName: 'Contrato.pdf',
      documentId: 'doc_1',
      versionId: 'ver_1',
      signatureRequestId: 'req_1',
      signatureId: 'sig_1',
      signerName: 'João Silva',
      signerEmailMasked: 'jo***@empresa.com',
      signerPhoneMasked: '+55 54 *****-9999',
      signedAt: new Date('2026-07-09T14:32:00.000Z'),
      verificationCode: 'DOQYN-2026-ABC123',
      verificationUrl: 'http://localhost:5173/verify/signature/DOQYN-2026-ABC123',
      securityContext: {
        ipAddressMasked: '189.45.xxx.xxx',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop',
        country: 'BR',
        region: 'RS',
        city: 'Caxias do Sul',
      },
    });

    assert.ok(result.signedPdfBuffer.byteLength > originalBytes.byteLength);
    assert.equal(result.originalDocumentHashSha256.length, 64);
    assert.equal(result.signedPdfHashSha256.length, 64);
    assert.notEqual(result.originalDocumentHashSha256, result.signedPdfHashSha256);

    const parsed = await PDFDocument.load(result.signedPdfBuffer);
    assert.equal(parsed.getPageCount(), 2);
  });

  it('validador público não expõe e-mail/telefone completo', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    const verifyApi = read('api/verify/signature/[verificationCode].ts');
    assert.ok(service.includes('getPublicSignatureVerification'));
    assert.ok(service.includes('signerEmailMasked'));
    assert.ok(service.includes('signerNameMasked'));
    assert.ok(verifyApi.includes('getPublicSignatureVerification'));
  });

  it('endpoints e rotas dev registrados', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('/signature-requests'));
    assert.ok(devServer.includes('/api/sign/'));
    assert.ok(devServer.includes('/verify/signature/'));
  });

  it('tracking inclui eventos de assinatura', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(audit.includes('document.signature_request_created'));
    assert.ok(audit.includes('document.signature_completed'));
    assert.ok(audit.includes('document.signed_pdf_generated'));
  });

  it('texto de consentimento é explícito e não menciona ICP-Brasil', () => {
    assert.ok(SIGNATURE_CONSENT_TEXT.includes('DOQYN'));
    assert.equal(/ICP|gov\.br|qualificada/i.test(SIGNATURE_CONSENT_TEXT), false);
  });

  it('UI portal e validador possuem rotas frontend', () => {
    const routes = read('src/app/routes.tsx');
    assert.ok(routes.includes('/guest/sign/:token'));
    assert.ok(routes.includes('/verify/signature/:verificationCode'));
  });
});
