import { ImageAnnotatorClient } from '@google-cloud/vision';
import { renderPdfPageToPng } from '../../preview/pdfPageRenderer.js';
import {
  bufferMeta,
  pipelineDebug,
  pipelineError,
  pipelineInfo,
  pipelineWarn,
  previewText,
} from '../utils/pipelineDebug.js';
import { normalizeDocumentText } from '../utils/textNormalization.js';
import {
  ensureGoogleCredentialsEnv,
  getVisionOcrDpi,
  getVisionOcrMaxPages,
  getVisionOcrTimeoutMs,
  isVisionOcrConfigured,
  isVisionOcrEnabled,
  resolveGoogleCredentialsPath,
} from './visionConfig.js';
import type { VisionOcrPageText, VisionOcrResult } from './visionTypes.js';

let clientSingleton: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (clientSingleton) {
    pipelineDebug('vision.client', 'reusando ImageAnnotatorClient singleton');
    return clientSingleton;
  }
  const creds = ensureGoogleCredentialsEnv();
  pipelineInfo('vision.client', 'criando ImageAnnotatorClient', {
    credentialsPath: creds,
    credentialsResolved: Boolean(resolveGoogleCredentialsPath()),
  });
  clientSingleton = new ImageAnnotatorClient();
  return clientSingleton;
}

/** Reseta o client (útil em testes). */
export function resetVisionOcrClientForTests(): void {
  clientSingleton = null;
  pipelineDebug('vision.client', 'singleton resetado (tests)');
}

export async function ocrImageBuffer(
  imageBuffer: Buffer,
  options?: { pageNumber?: number },
): Promise<VisionOcrPageText> {
  const pageNumber = options?.pageNumber ?? 1;
  const startedAt = Date.now();

  pipelineInfo('vision.ocrImage', 'inicio documentTextDetection', {
    pageNumber,
    ...bufferMeta(imageBuffer, 'image'),
    enabled: isVisionOcrEnabled(),
    configured: isVisionOcrConfigured(),
  });

  if (!isVisionOcrConfigured()) {
    pipelineError('vision.ocrImage', 'Vision OCR não configurado', undefined, { pageNumber });
    throw new Error('Vision OCR não configurado');
  }

  try {
    const client = getVisionClient();
    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
    });

    const visionError = (result as { error?: { message?: string; code?: number } }).error;
    if (visionError) {
      pipelineWarn('vision.ocrImage', 'Vision API retornou error no payload', {
        pageNumber,
        visionErrorCode: visionError.code,
        visionErrorMessage: visionError.message,
      });
    }

    const rawText = result.fullTextAnnotation?.text ?? '';
    const text = normalizeDocumentText(rawText);
    const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence;
    const blockCount = result.fullTextAnnotation?.pages?.[0]?.blocks?.length;
    const textAnnotations = result.textAnnotations?.length ?? 0;

    pipelineInfo('vision.ocrImage', 'documentTextDetection ok', {
      pageNumber,
      durationMs: Date.now() - startedAt,
      rawCharCount: rawText.length,
      normalizedCharCount: text.length,
      confidence,
      blockCount,
      textAnnotations,
      textPreview: previewText(text, 180),
      hasFullTextAnnotation: Boolean(result.fullTextAnnotation),
    });

    return {
      pageNumber,
      text,
      confidence: typeof confidence === 'number' ? confidence : undefined,
    };
  } catch (error) {
    pipelineError('vision.ocrImage', 'documentTextDetection falhou', error, {
      pageNumber,
      durationMs: Date.now() - startedAt,
      ...bufferMeta(imageBuffer, 'image'),
    });
    throw error;
  }
}

export async function ocrPdfPages(
  pdfBuffer: Buffer,
  options?: { pageCountHint?: number; maxPages?: number },
): Promise<VisionOcrResult> {
  const startedAt = Date.now();

  pipelineInfo('vision.ocrPdf', 'inicio OCR multipágina', {
    ...bufferMeta(pdfBuffer, 'pdf'),
    pageCountHint: options?.pageCountHint,
    maxPagesOption: options?.maxPages,
    envMaxPages: getVisionOcrMaxPages(),
    dpi: getVisionOcrDpi(),
    timeoutMs: getVisionOcrTimeoutMs(),
    enabled: isVisionOcrEnabled(),
    configured: isVisionOcrConfigured(),
  });

  if (!isVisionOcrEnabled()) {
    pipelineError('vision.ocrPdf', 'Vision OCR desabilitado', undefined);
    throw new Error('Vision OCR desabilitado');
  }
  if (!isVisionOcrConfigured()) {
    pipelineError('vision.ocrPdf', 'Vision OCR não configurado', undefined);
    throw new Error('Vision OCR não configurado');
  }

  const maxPages = Math.max(1, options?.maxPages ?? getVisionOcrMaxPages());
  const hint = options?.pageCountHint && options.pageCountHint > 0 ? options.pageCountHint : maxPages;
  const pagesToProcess = Math.min(maxPages, hint);
  const dpi = getVisionOcrDpi();
  const timeoutMs = getVisionOcrTimeoutMs();

  pipelineDebug('vision.ocrPdf', 'parâmetros efetivos', {
    maxPages,
    hint,
    pagesToProcess,
    dpi,
    timeoutMs,
  });

  const pages: VisionOcrPageText[] = [];
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
    const pageStartedAt = Date.now();
    try {
      pipelineDebug('vision.renderPage', 'Ghostscript render iniciando', {
        pageNumber,
        dpi,
        timeoutMs,
        pagesToProcess,
      });

      const rendered = await renderPdfPageToPng({
        pdfBuffer,
        pageNumber,
        dpi,
        timeoutMs,
      });

      pipelineDebug('vision.renderPage', 'Ghostscript render ok', {
        pageNumber,
        renderDurationMs: Date.now() - pageStartedAt,
        mimeType: rendered.mimeType,
        ...bufferMeta(rendered.buffer, 'png'),
      });

      const ocrPage = await ocrImageBuffer(rendered.buffer, { pageNumber });
      pages.push(ocrPage.text.length > 0 ? ocrPage : { pageNumber, text: '' });

      pipelineInfo('vision.ocrPdf', 'página concluída', {
        pageNumber,
        pageTotalDurationMs: Date.now() - pageStartedAt,
        pageCharCount: ocrPage.text.length,
        pageConfidence: ocrPage.confidence,
        pagesDone: pages.length,
        pagesRemaining: pagesToProcess - pageNumber,
      });
    } catch (error) {
      pipelineWarn('vision.ocrPdf', 'página falhou — interrompendo loop', {
        pageNumber,
        pagesCollected: pages.length,
        pageDurationMs: Date.now() - pageStartedAt,
        ...({} as Record<string, unknown>),
      });
      pipelineError('vision.ocrPdf', `falha na página ${pageNumber}`, error, {
        pageNumber,
        pagesCollected: pages.length,
      });

      if (pages.length === 0 && pageNumber === 1) {
        throw error;
      }
      truncated = true;
      break;
    }
  }

  if ((options?.pageCountHint ?? 0) > pagesToProcess) {
    truncated = true;
    pipelineDebug('vision.ocrPdf', 'truncado por limite de páginas', {
      pageCountHint: options?.pageCountHint,
      pagesToProcess,
    });
  }

  const text = pages
    .map((page) => page.text)
    .filter(Boolean)
    .join('\n\n');

  const durationMs = Date.now() - startedAt;
  const emptyPages = pages.filter((p) => !p.text).length;

  pipelineInfo('vision.ocrPdf', 'OCR multipágina concluído', {
    pagesProcessed: pages.length,
    emptyPages,
    charCount: text.length,
    truncated,
    durationMs,
    avgMsPerPage: pages.length > 0 ? Math.round(durationMs / pages.length) : null,
    textPreview: previewText(text, 200),
  });

  return {
    text,
    pages,
    pageCount: options?.pageCountHint ?? pages.length,
    charCount: text.length,
    truncated,
    provider: 'google_vision',
    pagesProcessed: pages.length,
    durationMs,
  };
}

export { isVisionOcrConfigured, isVisionOcrEnabled };
