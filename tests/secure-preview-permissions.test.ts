import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('secure preview permissions', () => {
  const previewServiceSource = readFileSync(
    join(process.cwd(), 'server/services/documentPreviewService.ts'),
    'utf8',
  );
  const manifestServiceSource = readFileSync(
    join(process.cwd(), 'server/services/documentPreviewManifestService.ts'),
    'utf8',
  );
  const modalSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/DocumentViewerModal.tsx'),
    'utf8',
  );
  const pdfPagesSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/PdfPagesViewer.tsx'),
    'utf8',
  );
  const globalsSource = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

  it('blob PDF bloqueado sem canDownload', () => {
    assert.match(previewServiceSource, /PREVIEW_BLOB_RESTRICTED/);
    assert.match(previewServiceSource, /!permissions\.canDownload/);
    assert.match(previewServiceSource, /allowBlobWithoutDownload/);
  });

  it('page preview usa allowBlobWithoutDownload apenas no backend interno', () => {
    assert.match(manifestServiceSource, /allowBlobWithoutDownload: true/);
    assert.match(manifestServiceSource, /readDocumentPreviewPageImage/);
  });

  it('modal não usa iframe/object/embed', () => {
    assert.doesNotMatch(modalSource, /<iframe|<object|<embed/);
    assert.match(modalSource, /usePreviewManifest/);
    assert.match(modalSource, /resolveViewerComponent/);
  });

  it('modal bloqueia Ctrl+P sem canDownload', () => {
    assert.match(modalSource, /handlePrintShortcut/);
    assert.match(modalSource, /impressão deste documento não está disponível/i);
    assert.match(modalSource, /doqyn-secure-viewer/);
  });

  it('CSS oculta viewer seguro na impressão', () => {
    assert.match(globalsSource, /@media print/);
    assert.match(globalsSource, /\.doqyn-secure-viewer/);
    assert.match(globalsSource, /display: none !important/);
  });

  it('PdfPagesViewer usa páginas do manifest, não blob PDF', () => {
    assert.match(pdfPagesSource, /previewUrl/);
    assert.match(pdfPagesSource, /usePreviewAsset/);
    assert.doesNotMatch(pdfPagesSource, /<iframe|<object|<embed/);
  });

  it('download depende de canDownload no modal', () => {
    assert.match(modalSource, /permissions\.canDownload/);
    assert.match(modalSource, /onDownload: permissions\.canDownload/);
  });

  it('hook legado de blob não é usado pelo modal ativo', () => {
    assert.doesNotMatch(modalSource, /useDocumentPreviewBlob/);
    const blobsApiSource = readFileSync(
      join(process.cwd(), 'src/features/documents/api/documentsApi.blobs.ts'),
      'utf8',
    );
    assert.match(blobsApiSource, /preview/);
  });

  it('manifest e page endpoints não expõem objectKey', () => {
    assert.doesNotMatch(manifestServiceSource, /objectKey.*json|r2\.cloudflarestorage|presigned/i);
  });
});
