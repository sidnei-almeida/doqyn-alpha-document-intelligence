import { PDFDocument } from 'pdf-lib';

export type PdfPageDimension = {
  page: number;
  width: number;
  height: number;
  rotation: number;
  aspectRatio: number;
};

export async function extractPdfPageDimensions(pdfBuffer: Buffer): Promise<PdfPageDimension[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  return pages.map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle % 360;
    const isRotated = rotation === 90 || rotation === 270;
    const displayWidth = isRotated ? height : width;
    const displayHeight = isRotated ? width : height;

    return {
      page: index + 1,
      width: Math.round(displayWidth),
      height: Math.round(displayHeight),
      rotation,
      aspectRatio: displayHeight > 0 ? Number((displayWidth / displayHeight).toFixed(4)) : 1,
    };
  });
}
