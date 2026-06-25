import { PDFParse } from 'pdf-parse';
import { MAX_TEXT_CHARS } from '../constants.js';
import type { ExtractedPdfText, PdfPageText } from '../types/documentAi.types.js';
import { normalizeDocumentText } from '../utils/textNormalization.js';

function truncatePages(pages: PdfPageText[]): { pages: PdfPageText[]; text: string; truncated: boolean } {
  let totalChars = 0;
  const result: PdfPageText[] = [];
  let truncated = false;

  for (const page of pages) {
    const remaining = MAX_TEXT_CHARS - totalChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    if (page.text.length <= remaining) {
      result.push(page);
      totalChars += page.text.length;
      continue;
    }

    result.push({
      pageNumber: page.pageNumber,
      text: page.text.slice(0, remaining),
    });
    totalChars += remaining;
    truncated = true;
    break;
  }

  const text = result.map((p) => p.text).join('\n\n');
  return { pages: result, text, truncated };
}

export async function extractTextFromPdf(fileBuffer: Buffer): Promise<ExtractedPdfText> {
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const textResult = await parser.getText();

    const pages: PdfPageText[] =
      textResult.pages?.length > 0
        ? textResult.pages.map((page) => ({
            pageNumber: page.num,
            text: normalizeDocumentText(page.text ?? ''),
          }))
        : [
            {
              pageNumber: 1,
              text: normalizeDocumentText(textResult.text ?? ''),
            },
          ];

    const nonEmptyPages = pages.filter((page) => page.text.length > 0);
    const sourcePages = nonEmptyPages.length > 0 ? nonEmptyPages : pages;
    const { pages: finalPages, text, truncated } = truncatePages(sourcePages);

    return {
      text,
      pages: finalPages,
      pageCount: textResult.total || finalPages.length,
      charCount: text.length,
      truncated,
    };
  } finally {
    await parser.destroy();
  }
}
