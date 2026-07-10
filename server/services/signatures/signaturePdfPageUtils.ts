import type { PDFDocument, PDFPage } from 'pdf-lib';

export const SIGNATURE_CERTIFICATE_PAGE_TITLE = 'Certificado de Assinatura Eletrônica';
/** Marcador invisível em páginas de certificado para auditoria futura. */
export const SIGNATURE_CERTIFICATE_PAGE_MARKER = 'DOQYN_SIGNATURE_CERTIFICATE_PAGE';

/**
 * Cada assinatura concluída anexa exatamente uma página de certificado ao final.
 * A página do carimbo é sempre: total de páginas − assinaturas já concluídas.
 */
export function resolveSignatureStampPageIndex(
  pageCount: number,
  completedSignatureCount: number,
): number {
  if (pageCount <= 0) {
    throw new Error('PDF sem páginas para aplicar carimbo de assinatura.');
  }

  const trailingCertificates = Math.max(
    0,
    Math.min(completedSignatureCount, Math.max(0, pageCount - 1)),
  );
  const contentPageCount = Math.max(1, pageCount - trailingCertificates);
  return contentPageCount - 1;
}

export function resolveSignatureStampTargetPage(
  pdfDoc: PDFDocument,
  completedSignatureCount = 0,
): PDFPage {
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('PDF sem páginas para aplicar carimbo de assinatura.');
  }

  const pageIndex = resolveSignatureStampPageIndex(pages.length, completedSignatureCount);
  return pages[pageIndex]!;
}
