# Document Viewer — DOQYN

## Visão geral

O visualizador de documentos usa um **manifest de preview autenticado** em vez de expor blobs PDF ou URLs R2 ao frontend.

Fluxo principal:

1. `GET /api/documents/:id/versions/:versionId/preview/manifest`
2. Frontend escolhe viewer por `viewerType` (`pdf_pages`, `image`, `unsupported`)
3. Assets carregados via endpoints autenticados (`/pages`, `/thumbnails`, `/image`)

## Manifest persistido

Após gerar o preview (confirm-analysis ou sob demanda), o backend persiste `previewManifest` em `document_versions`:

- **PDF:** `viewerType: pdf_pages`, dimensões por página, `source: preview_pdf`
- **Imagem:** `viewerType: image`, resoluções small/medium/large/thumbnail, `source: preview_image`

O endpoint de manifest **prioriza** o manifest salvo. Se ausente, extrai dimensões do PDF watermarkado, persiste e retorna.

`objectKey` e URLs R2 **nunca** são expostos na API pública — apenas paths relativos autenticados.

## Preview PDF por páginas

- Páginas renderizadas a partir do **PDF watermarkado**, não do original
- Primeira requisição: Ghostscript renderiza PNG
- Cache em storage: `preview/pages/page-N.png` e `preview/thumbnails/thumb-page-N.png`
- Próximas requisições leem do cache

## Preview de imagens

Suportado: `image/jpeg`, `image/png`, `image/webp`

- Geração com **sharp** + watermark DOQYN
- Resoluções: thumbnail, small (720), medium (1440), large (2400)
- Original nunca é servido para usuários sem `canDownload`

## canPreview vs canDownload

| Permissão | Comportamento |
|-----------|---------------|
| `canPreview` | Acessa manifest + páginas/imagens watermarkadas |
| `canDownload` | Pode baixar original via `GET /api/documents/download` |
| Preview sem download | **Não** recebe blob PDF (`PREVIEW_BLOB_RESTRICTED` 403) |
| Ctrl+P no viewer | Bloqueado com aviso quando `canDownload=false` |
| Impressão | CSS `@media print` oculta `.doqyn-secure-viewer` |

## Tracking

- `document.preview_viewed` — emitido ao carregar manifest com sucesso (uma vez por abertura)
- `document.downloaded` — no download do original
- Navegação entre páginas/zoom **não** gera spam de eventos

## Limitações conhecidas

- Screenshot/foto da tela ainda são possíveis (limitação inerente)
- Ghostscript necessário para renderização de páginas PDF
- TIFF/HEIC: `viewerType: unsupported`

## Componentes legados

- `PdfDocumentViewer` (pdf.js) — órfão, não usado no fluxo ativo
- `useDocumentPreviewBlob` — hook legado para blob PDF; modal atual usa manifest
