import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { resolveRequestLocale } from '../server/i18n/index.ts';
import { renderOgPortalHtml } from '../server/og/renderOgPortalHtml.ts';
import {
  generateSignedPdf,
  SIGNATURE_CONSENT_TEXT,
  signatureConsentText,
} from '../server/services/signatures/signaturePdfService.ts';
import { buildCompactStampLines } from '../server/services/signatures/signatureStampLayout.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('idioma da requisição sem sessão', () => {
  it('?lang= vence, depois o perfil, depois o primeiro idioma conhecido do navegador', () => {
    assert.equal(
      resolveRequestLocale({ query: { lang: 'en-US' }, headers: { 'accept-language': 'es' } }),
      'en-US',
    );
    assert.equal(resolveRequestLocale({ headers: { 'accept-language': 'es' } }, 'pt-BR'), 'pt-BR');
    assert.equal(
      resolveRequestLocale({ headers: { 'accept-language': 'fr-FR, es-MX;q=0.8' } }),
      'es-419',
    );
    assert.equal(resolveRequestLocale({ query: { lang: 'klingon' } }), 'pt-BR');
    assert.equal(resolveRequestLocale({}), 'pt-BR');
  });
});

describe('certificado de assinatura no idioma do aceite', () => {
  it('a declaração em pt-BR é a mesma de antes, e as outras dizem DOQYN', () => {
    assert.ok(SIGNATURE_CONSENT_TEXT.startsWith('Declaro que li o documento apresentado'));
    assert.match(signatureConsentText('en-US'), /^I declare that I have read/);
    assert.match(signatureConsentText('es-419'), /DOQYN/);
    assert.equal(/ICP|gov\.br|qualifi/i.test(signatureConsentText('es-419')), false);
  });

  it('a evidência grava a declaração no idioma do aceite, e o PDF se gera com acento e ¿', async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const result = await generateSignedPdf({
      originalPdfBuffer: Buffer.from(await original.save()),
      documentName: 'Contrato ¿firmado?.pdf',
      documentId: 'doc_1',
      versionId: 'ver_1',
      signatureRequestId: 'req_1',
      signatureId: 'sig_1',
      signerName: 'Íñigo Muñoz',
      signerEmailMasked: 'in***@x.com',
      signedAt: new Date('2026-07-09T14:32:00.000Z'),
      verificationCode: 'DOQYN-2026-ABC123',
      verificationUrl: 'https://app.doqyn.com/verify/signature/DOQYN-2026-ABC123',
      previousStamps: [
        { signerName: 'Ana', signedAt: new Date(), verificationCode: 'DOQYN-2026-X' },
      ],
      locale: 'es-MX',
    });

    assert.equal(result.evidencePayload.consentLocale, 'es-419');
    assert.equal(result.evidencePayload.consentText, signatureConsentText('es-419'));
    assert.equal((await PDFDocument.load(result.signedPdfBuffer)).getPageCount(), 2);
  });

  it('o carimbo compacto fala o idioma, e o marcador DOQYN não muda', () => {
    const stamp = {
      signerName: 'Ana',
      signedAt: new Date('2026-07-09T14:32:00.000Z'),
      verificationCode: 'DOQYN-2026-ABC',
    };
    const [, whenEn, code] = buildCompactStampLines(stamp, 'en-US');
    assert.match(whenEn ?? '', /^Signed 07\/09\/26/);
    assert.equal(code, 'DOQYN 2026-ABC');
    assert.match(buildCompactStampLines(stamp)[1] ?? '', /^Assinado em 09\/07\/26/);
  });

  it('o portal devolve o idioma que mostrou, e a assinatura grava com ele', () => {
    const api = read('src/features/signature/api/signatureApi.ts');
    assert.match(api, /consentLocale, action: 'sign'/);
    assert.match(api, /signing-payload\?\$\{uiLocaleQuery\(\)\}/);
    assert.match(
      read('src/features/signature/SignaturePortalPage.tsx'),
      /payload\?\.consentLocale/,
    );
    assert.match(read('api/sign/[token]/sign.ts'), /consentLocale: body\.consentLocale/);
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.equal(service.includes('SIGNATURE_CONSENT_TEXT'), false);
    assert.match(
      service,
      /consentText: signatureConsentText\(consentLocale\),\n\s+consentLocale,\n\s+authMethod/,
    );
  });
});

describe('cartão do link no idioma pedido', () => {
  it('lang, og:locale e rodapé acompanham o idioma', () => {
    const html = renderOgPortalHtml({
      kind: 'share',
      available: true,
      title: 'Shared document · DOQYN',
      description: 'A document was shared with you.',
      imageUrl: 'https://app.doqyn.com/og/portal-card-share.png',
      canonicalUrl: 'https://app.doqyn.com/guest/share/t',
      portalPath: '/guest/share/t',
      ctaLabel: 'Open document',
      ownerTenantName: 'Horizonte <SA>',
      locale: 'es-419',
    });
    assert.match(html, /<html lang="es-419">/);
    assert.match(html, /<meta property="og:locale" content="es_LA" \/>/);
    assert.match(html, /Gestión segura/);
    assert.match(html, /Compartido vía Horizonte &lt;SA&gt;/);
  });

  it('a página do robô pede o idioma e declara Vary', () => {
    for (const kind of ['sign', 'share']) {
      const handler = read(`api/og/guest/${kind}/[token].ts`);
      assert.match(handler, /resolveRequestLocale\(req\)/);
      assert.match(handler, /'Vary', 'Accept-Language'/);
    }
  });
});
