import { getPdfPreviewConfig } from './previewConfig.js';
import { addDoqynWatermarkToPdf } from './pdfWatermark.js';
import { optimizePdfWithGhostscript, type GhostscriptOptimizerDeps } from './ghostscriptOptimizer.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type GeneratePdfPreviewInput = {
  originalPdf: Buffer;
  watermarkText?: string;
  ghostscriptPath?: string;
  timeoutMs?: number;
  profile?: string;
  maxInputBytes?: number;
};

export type GeneratePdfPreviewResult = {
  buffer: Buffer;
  originalSizeBytes: number;
  previewSizeBytes: number;
  compressionRatio: number;
  watermarkText: string;
  profile: string;
};

export type PdfPreviewGeneratorDeps = GhostscriptOptimizerDeps & {
  addWatermark?: typeof addDoqynWatermarkToPdf;
  optimize?: typeof optimizePdfWithGhostscript;
};

export async function generatePdfPreview(
  input: GeneratePdfPreviewInput,
  deps: PdfPreviewGeneratorDeps = {},
): Promise<GeneratePdfPreviewResult> {
  const config = getPdfPreviewConfig();
  const maxInputBytes = input.maxInputBytes ?? config.maxInputBytes;

  if (input.originalPdf.length === 0) {
    throw new ServiceError('PDF original vazio.', 'PREVIEW_EMPTY_INPUT', 400);
  }

  if (input.originalPdf.length > maxInputBytes) {
    throw new ServiceError(
      'PDF excede o limite para geração de preview.',
      'PREVIEW_INPUT_TOO_LARGE',
      413,
    );
  }

  const watermarkText = input.watermarkText?.trim() || config.watermarkText;
  const addWatermark = deps.addWatermark ?? addDoqynWatermarkToPdf;
  const optimize = deps.optimize ?? optimizePdfWithGhostscript;

  const watermarked = await addWatermark({
    pdfBuffer: input.originalPdf,
    watermarkText,
  });

  const optimized = await optimize({
    inputBuffer: watermarked,
    ghostscriptPath: input.ghostscriptPath ?? config.ghostscriptPath,
    timeoutMs: input.timeoutMs ?? config.timeoutMs,
    profile: input.profile ?? config.profile,
  });

  const originalSizeBytes = input.originalPdf.length;
  const previewSizeBytes = optimized.length;
  const compressionRatio =
    originalSizeBytes > 0 ? Number((previewSizeBytes / originalSizeBytes).toFixed(4)) : 1;

  return {
    buffer: optimized,
    originalSizeBytes,
    previewSizeBytes,
    compressionRatio,
    watermarkText,
    profile: input.profile ?? config.profile,
  };
}
