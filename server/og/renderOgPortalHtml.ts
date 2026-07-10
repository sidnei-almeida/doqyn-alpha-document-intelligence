import type { OgPortalMetadata } from './ogPortalMetadata.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function renderOgPortalHtml(metadata: OgPortalMetadata): string {
  const title = escapeHtml(truncate(metadata.title, 120));
  const description = escapeHtml(truncate(metadata.description, 300));
  const imageUrl = escapeHtml(metadata.imageUrl);
  const canonicalUrl = escapeHtml(metadata.canonicalUrl);
  const portalPath = escapeHtml(metadata.portalPath);
  const documentName = escapeHtml(metadata.documentName ?? 'Documento');
  const issuerName = escapeHtml(metadata.issuerName ?? 'DOQYN');
  const ownerTenantName = escapeHtml(metadata.ownerTenantName ?? '');
  const statusLabel = escapeHtml(metadata.statusLabel ?? 'DOQYN');
  const ctaLabel = escapeHtml(metadata.ctaLabel);
  const versionLabel = metadata.versionLabel
    ? escapeHtml(
        metadata.versionLabel.startsWith('v') ? metadata.versionLabel : `v${metadata.versionLabel}`,
      )
    : '';

  const eyebrow =
    metadata.kind === 'sign'
      ? 'Solicitação de assinatura'
      : ownerTenantName
        ? `Compartilhado via ${ownerTenantName}`
        : 'Compartilhamento seguro';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="DOQYN" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:alt" content="${documentName}" />
    <meta property="og:url" content="${canonicalUrl}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <meta name="theme-color" content="#121212" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #121212;
        --surface: #1e1e1e;
        --border: rgba(255, 255, 255, 0.08);
        --text: #e8eaed;
        --muted: #9aa0a6;
        --accent: #8ab4f8;
        --accent-strong: #aecbfa;
        --success: #81c995;
        --warning: #fdd663;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Roboto, system-ui, -apple-system, Segoe UI, sans-serif;
        background:
          radial-gradient(circle at top right, rgba(138, 180, 248, 0.12), transparent 34%),
          var(--bg);
        color: var(--text);
      }
      .wrap {
        max-width: 720px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 24px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .brand img { height: 22px; width: auto; opacity: 0.92; }
      .card {
        border: 1px solid var(--border);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        overflow: hidden;
      }
      .preview {
        aspect-ratio: 1200 / 630;
        background: #181818;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .content { padding: 24px; }
      .eyebrow {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 0 0 8px;
      }
      h1 {
        margin: 0;
        font-size: clamp(1.25rem, 2.8vw, 1.75rem);
        line-height: 1.25;
        font-weight: 600;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        color: var(--muted);
        background: rgba(255,255,255,0.03);
      }
      .pill--accent { color: var(--accent-strong); border-color: rgba(138,180,248,0.28); }
      .pill--warn { color: var(--warning); border-color: rgba(253,214,99,0.28); }
      p {
        margin: 16px 0 0;
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }
      .cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 22px;
        min-height: 42px;
        padding: 0 18px;
        border-radius: 999px;
        background: var(--accent);
        color: #0b0f14;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        box-shadow: 0 8px 24px rgba(138, 180, 248, 0.22);
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="brand">
        <img src="/brand/doqyn-horizontal.webp" alt="DOQYN" />
        <span>Document Intelligence</span>
      </div>
      <article class="card">
        <div class="preview">
          <img src="${imageUrl}" alt="${documentName}" />
        </div>
        <div class="content">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${documentName}</h1>
          <div class="meta">
            <span class="pill pill--accent">${statusLabel}</span>
            ${versionLabel ? `<span class="pill">${versionLabel}</span>` : ''}
            <span class="pill">${issuerName}</span>
          </div>
          <p>${description}</p>
          <a class="cta" href="${portalPath}">${ctaLabel}</a>
          <p class="footer">Gestão segura, inteligente e rastreável de documentos empresariais.</p>
        </div>
      </article>
    </main>
  </body>
</html>`;
}
