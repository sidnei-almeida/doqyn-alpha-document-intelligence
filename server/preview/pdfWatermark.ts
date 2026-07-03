import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type AddPdfWatermarkInput = {
  pdfBuffer: Buffer;
  watermarkText?: string;
};

/** Aplica marca d'água textual diagonal em todas as páginas — não altera o original persistido. */
export async function addDoqynWatermarkToPdf(input: AddPdfWatermarkInput): Promise<Buffer> {
  const text = (input.watermarkText?.trim() || 'DOQYN').slice(0, 32);
  const pdfDoc = await PDFDocument.load(input.pdfBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) * 0.12;
    const stepX = width * 0.45;
    const stepY = height * 0.35;

    for (let y = -height * 0.2; y < height * 1.2; y += stepY) {
      for (let x = -width * 0.2; x < width * 1.2; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.55, 0.55, 0.55),
          opacity: 0.18,
          rotate: degrees(-35),
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
