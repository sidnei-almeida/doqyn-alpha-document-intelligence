import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('document viewer PDF.js architecture (legacy)', () => {
  const modalSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/DocumentViewerModal.tsx'),
    'utf8',
  );
  const pdfPagesSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/PdfPagesViewer.tsx'),
    'utf8',
  );
  const registrySource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/viewerRegistry.ts'),
    'utf8',
  );
  const legacyPreviewSource = readFileSync(
    join(process.cwd(), 'src/features/documents/components/DocumentPreviewViewer.tsx'),
    'utf8',
  );

  it('DocumentViewerModal usa manifest e registry', () => {
    assert.match(modalSource, /usePreviewManifest/);
    assert.match(modalSource, /resolveViewerComponent/);
  });

  it('não renderiza iframe/object como viewer principal', () => {
    assert.doesNotMatch(pdfPagesSource, /<iframe|<object|<embed/);
    assert.doesNotMatch(modalSource, /<iframe|<object|<embed/);
    assert.doesNotMatch(legacyPreviewSource, /<iframe|<object|<embed/);
  });

  it('viewer registry escolhe PdfPagesViewer para pdf_pages', () => {
    assert.match(registrySource, /PdfPagesViewer/);
    assert.match(registrySource, /ImageViewer/);
  });
});
