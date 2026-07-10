import { degrees, PDFDocument } from 'pdf-lib';
import {
  computeWatermarkTileLayout,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_ROTATION_DEG,
} from './watermarkTiling.js';
import { rasterizeDoqynWatermarkLogo } from './watermarkAsset.js';

export type AddPdfWatermarkInput = {
  pdfBuffer: Buffer;
  watermarkText?: string;
};

/** Aplica marca d'água com a logo horizontal DOQYN em todas as páginas — não altera o original persistido. */
export async function addDoqynWatermarkToPdf(input: AddPdfWatermarkInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input.pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const opacity = DEFAULT_WATERMARK_OPACITY;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const { tileWidth, positions } = computeWatermarkTileLayout(width, height);
    const logoBuffer = await rasterizeDoqynWatermarkLogo(Math.max(320, Math.round(tileWidth * 2.5)));
    const logoImage = await pdfDoc.embedPng(logoBuffer);
    const scale = tileWidth / logoImage.width;
    const logoWidth = logoImage.width * scale;
    const logoHeight = logoImage.height * scale;

    for (const position of positions) {
      page.drawImage(logoImage, {
        x: position.x - logoWidth / 2,
        y: position.y - logoHeight / 2,
        width: logoWidth,
        height: logoHeight,
        opacity,
        rotate: degrees(DEFAULT_WATERMARK_ROTATION_DEG),
      });
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
