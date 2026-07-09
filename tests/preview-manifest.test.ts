import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { extractPdfPageDimensions } from '../server/preview/pdfPageDimensions.js';

describe('preview manifest backend', () => {
  const manifestServiceSource = readFileSync(
    join(process.cwd(), 'server/services/documentPreviewManifestService.ts'),
    'utf8',
  );
  const manifestHandlerSource = readFileSync(
    join(process.cwd(), 'api/documents/preview-manifest.ts'),
    'utf8',
  );
  const pageHandlerSource = readFileSync(
    join(process.cwd(), 'api/documents/preview-page.ts'),
    'utf8',
  );
  const previewServiceSource = readFileSync(
    join(process.cwd(), 'server/services/documentPreviewService.ts'),
    'utf8',
  );

  it('manifest service define viewerType pdf_pages e pages com dimensões', () => {
    assert.match(manifestServiceSource, /viewerType: 'pdf_pages'/);
    assert.match(manifestServiceSource, /width: page\.width/);
    assert.match(manifestServiceSource, /height: page\.height/);
    assert.match(manifestServiceSource, /aspectRatio/);
    assert.match(manifestServiceSource, /previewUrl/);
    assert.match(manifestServiceSource, /ensurePdfPreviewManifest/);
    assert.match(manifestServiceSource, /saveVersionPreviewManifest/);
  });

  it('manifest de imagem retorna viewerType image e dimensões', () => {
    assert.match(manifestServiceSource, /viewerType: 'image'/);
    assert.match(manifestServiceSource, /resolutions/);
    assert.match(manifestServiceSource, /previewUrl/);
  });

  it('manifest não expõe objectKey/R2 na resposta pública', () => {
    assert.doesNotMatch(manifestHandlerSource, /objectKey|r2\.cloudflarestorage|presigned/i);
    assert.doesNotMatch(pageHandlerSource, /r2\.cloudflarestorage|presigned/i);
    assert.match(manifestServiceSource, /previewUrl/);
    assert.match(manifestServiceSource, /thumbnailUrl/);
    assert.doesNotMatch(manifestServiceSource, /r2\.cloudflarestorage|presigned/i);
  });

  it('manifest handler exige auth e cache privado versionado', () => {
    assert.match(manifestHandlerSource, /requireDocumentAuthContext/);
    assert.match(manifestHandlerSource, /setPreviewManifestCacheHeaders/);
    assert.match(manifestHandlerSource, /document\.preview_viewed/);
  });

  it('preview blob bloqueia usuário sem canDownload', () => {
    assert.match(previewServiceSource, /PREVIEW_BLOB_RESTRICTED/);
    assert.match(previewServiceSource, /allowBlobWithoutDownload/);
    assert.match(previewServiceSource, /!permissions\.canDownload/);
  });

  it('page handler retorna cache privado via helper', () => {
    assert.match(pageHandlerSource, /setPreviewAssetCacheHeaders/);
    assert.match(pageHandlerSource, /requireDocumentAuthContext/);
  });

  it('extractPdfPageDimensions retorna dimensões por página', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([842, 595]);
    const bytes = await doc.save();
    const pages = await extractPdfPageDimensions(Buffer.from(bytes));
    assert.equal(pages.length, 2);
    assert.equal(pages[0].width, 595);
    assert.equal(pages[0].height, 842);
    assert.equal(pages[1].width, 842);
    assert.equal(pages[1].height, 595);
  });
});

describe('preview manifest frontend', () => {
  const modalSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/DocumentViewerModal.tsx'),
    'utf8',
  );
  const registrySource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/viewerRegistry.ts'),
    'utf8',
  );
  const pdfPagesSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/PdfPagesViewer.tsx'),
    'utf8',
  );
  const imageViewerSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/ImageViewer.tsx'),
    'utf8',
  );
  const manifestHookSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/usePreviewManifest.ts'),
    'utf8',
  );
  const assetHookSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/usePreviewAsset.ts'),
    'utf8',
  );

  it('DocumentViewerModal carrega manifest', () => {
    assert.match(modalSource, /usePreviewManifest/);
    assert.match(modalSource, /resolveViewerComponent/);
  });

  it('viewer registry escolhe componente por viewerType', () => {
    assert.match(registrySource, /pdf_pages.*PdfPagesViewer/s);
    assert.match(registrySource, /image.*ImageViewer/s);
    assert.match(registrySource, /UnsupportedViewer/);
  });

  it('PdfPagesViewer respeita width/height do manifest', () => {
    assert.match(pdfPagesSource, /page\.width/);
    assert.match(pdfPagesSource, /page\.height/);
    assert.match(pdfPagesSource, /previewUrl/);
    assert.match(pdfPagesSource, /thumbnailUrl/);
    assert.match(pdfPagesSource, /FULL_RENDER_PAGE_LIMIT/);
    assert.doesNotMatch(pdfPagesSource, /<iframe|<object|<embed/);
  });

  it('ImageViewer usa fit screen e zoom', () => {
    assert.match(imageViewerSource, /applyFitScreen/);
    assert.match(imageViewerSource, /zoomIn/);
    assert.match(imageViewerSource, /usePreviewAsset/);
  });

  it('botão download depende de canDownload no manifest', () => {
    assert.match(modalSource, /permissions\.canDownload/);
    assert.match(modalSource, /Visualização protegida/);
  });

  it('hooks limpam objectURL', () => {
    assert.match(assetHookSource, /revokeObjectURL/);
    assert.match(manifestHookSource, /preview-manifest/);
  });

  it('não expõe objectKey/R2 no frontend de manifest', () => {
    const apiSource = readFileSync(
      join(process.cwd(), 'src/features/documents/api/previewManifestApi.ts'),
      'utf8',
    );
    assert.doesNotMatch(apiSource, /objectKey|r2\.cloudflarestorage|presigned/i);
  });
});
