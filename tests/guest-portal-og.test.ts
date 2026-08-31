import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { renderOgPortalHtml } from '../server/og/renderOgPortalHtml.js';
import type { OgPortalMetadata } from '../server/og/ogPortalMetadata.js';

const root = new URL('../', import.meta.url);

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

const sampleSignMetadata: OgPortalMetadata = {
  kind: 'sign',
  available: true,
  title: 'Documento para assinar · DOQYN',
  description: 'Alguém solicitou sua assinatura em um documento. Abra o link para ver e assinar.',
  statusLabel: 'Assinatura pendente',
  imageUrl: 'https://app.doqyn.com/og/portal-card-sign.png',
  canonicalUrl: 'https://app.doqyn.com/guest/sign/sample-token',
  portalPath: '/guest/sign/sample-token',
  ctaLabel: 'Abrir e assinar',
};

describe('guest portal Open Graph', () => {
  it('renderiza HTML com meta tags Open Graph e Twitter Cards', () => {
    const html = renderOgPortalHtml(sampleSignMetadata);

    assert.ok(
      html.includes('<meta property="og:title" content="Documento para assinar · DOQYN" />'),
    );
    assert.ok(
      html.includes(
        '<meta property="og:image" content="https://app.doqyn.com/og/portal-card-sign.png" />',
      ),
    );
    assert.ok(
      html.includes(
        '<meta property="og:url" content="https://app.doqyn.com/guest/sign/sample-token" />',
      ),
    );
    assert.ok(html.includes('<meta property="og:type" content="website" />'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
    assert.ok(html.includes('Abrir e assinar'));
  });

  it('expõe rotas OG no dev-server e na Vercel', () => {
    const devServer = read('server/apiServer.ts');
    const vercel = read('vercel.json');

    assert.ok(devServer.includes('/api/og/guest/share/'));
    assert.ok(devServer.includes('/api/og/guest/sign/'));
    assert.ok(vercel.includes('/api/og/guest/share/:token'));
    assert.ok(vercel.includes('/api/og/guest/sign/:token'));
    assert.ok(vercel.includes('/share/:token'));
    assert.ok(vercel.includes('/sign/:token'));
  });

  it('frontend expõe aliases curtos e hook de meta no cliente', () => {
    const routes = read('src/app/routes.tsx');
    const sharePortal = read('src/features/external-share/ExternalSharePortalPage.tsx');
    const signPortal = read('src/features/signature/SignaturePortalPage.tsx');

    assert.ok(routes.includes("path: '/share/:token'"));
    assert.ok(routes.includes("path: '/sign/:token'"));
    assert.ok(sharePortal.includes('useGuestPortalPageMeta'));
    assert.ok(signPortal.includes('useGuestPortalPageMeta'));
  });

  /**
   * O robô que monta a prévia do link não se autentica, e o card que ele produz fica visível
   * para todo o grupo onde o link for colado. Estes três casos existem porque o caminho antigo
   * publicava ali o preview da primeira página, o nome do arquivo e a mensagem do remetente.
   */
  describe('o cartão do link não fala do documento', () => {
    it('nenhuma rota serve imagem derivada do documento para o robô', () => {
      const dispatcher = read('server/apiServer.ts');
      const metadata = read('server/og/ogPortalMetadata.ts');

      assert.ok(!dispatcher.includes('/api/og/guest/share/([^/]+)/image'));
      assert.ok(!dispatcher.includes('/api/og/guest/sign/([^/]+)/image'));
      assert.ok(!metadata.includes('/image`'));
      assert.ok(!existsSync(new URL('api/og/guest/sign/[token]/image.ts', root)));
      assert.ok(!existsSync(new URL('api/og/guest/share/[token]/image.ts', root)));
    });

    it('os cartões de marca existem em PNG, que é o que o WhatsApp renderiza', () => {
      // WebP não aparece em prévia de link no WhatsApp — era por isso que o cartão nunca
      // chegava ao chat mesmo com as meta tags corretas.
      for (const name of ['portal-card-sign', 'portal-card-share', 'portal-card']) {
        assert.ok(existsSync(new URL(`public/og/${name}.png`, root)), `falta ${name}.png`);
      }
    });

    it('a casca do app declara o cartão, para quem busca a prévia com user-agent de navegador', () => {
      // O WhatsApp Web busca pelo navegador do usuário, então nunca chega na página do robô.
      const html = read('index.html');

      assert.ok(
        html.includes('property="og:image" content="https://app.doqyn.com/og/portal-card.png"'),
      );
      assert.ok(html.includes('property="og:image:width" content="1200"'));
      assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
    });

    it('o corpo servido ao robô não carrega nome de documento nem remetente', () => {
      const html = renderOgPortalHtml(sampleSignMetadata);

      assert.ok(!html.includes('Contrato'));
      assert.ok(!html.includes('Maria Silva'));
      // O fallback do renderizador é o que aparece quando o metadata não traz o documento.
      assert.ok(html.includes('Documento'));
    });
  });
});
