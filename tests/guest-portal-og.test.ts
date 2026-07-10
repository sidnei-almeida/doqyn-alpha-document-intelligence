import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  title: 'Assinar: Contrato de Prestação de Serviços · v2.0 · DOQYN',
  description:
    'Maria Silva solicitou sua assinatura neste documento. Válido até 15/08/2026, 18:00:00.',
  documentName: 'Contrato de Prestação de Serviços',
  issuerName: 'Maria Silva',
  versionLabel: 'v2.0',
  statusLabel: 'Assinatura pendente',
  imageUrl: 'https://app.doqyn.com/api/og/guest/sign/sample-token/image',
  canonicalUrl: 'https://app.doqyn.com/guest/sign/sample-token',
  portalPath: '/guest/sign/sample-token',
  ctaLabel: 'Abrir e assinar',
};

describe('guest portal Open Graph', () => {
  it('renderiza HTML com meta tags Open Graph e Twitter Cards', () => {
    const html = renderOgPortalHtml(sampleSignMetadata);

    assert.ok(html.includes('<meta property="og:title" content="Assinar: Contrato de Prestação de Serviços · v2.0 · DOQYN" />'));
    assert.ok(html.includes('<meta property="og:description" content="Maria Silva solicitou sua assinatura neste documento. Válido até 15/08/2026, 18:00:00." />'));
    assert.ok(
      html.includes(
        '<meta property="og:image" content="https://app.doqyn.com/api/og/guest/sign/sample-token/image" />',
      ),
    );
    assert.ok(html.includes('<meta property="og:url" content="https://app.doqyn.com/guest/sign/sample-token" />'));
    assert.ok(html.includes('<meta property="og:type" content="website" />'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
    assert.ok(html.includes('Abrir e assinar'));
  });

  it('expõe rotas OG no dev-server e na Vercel', () => {
    const devServer = read('server/dev-server.ts');
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

  it('usa imagem padrão em public/og para convites sem preview', () => {
    const metadata: OgPortalMetadata = {
      ...sampleSignMetadata,
      kind: 'share',
      imageUrl: 'https://app.doqyn.com/og/portal-default.webp',
      canonicalUrl: 'https://app.doqyn.com/guest/share/sample-token',
      portalPath: '/guest/share/sample-token',
      ctaLabel: 'Aceitar e abrir',
    };
    const html = renderOgPortalHtml(metadata);
    assert.ok(html.includes('https://app.doqyn.com/og/portal-default.webp'));
  });
});
