import sharp from 'sharp';
import { getPdfPreviewConfig } from './previewConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { buildDoqynLogoWatermarkOverlay } from './watermarkTiling.js';

export type ImagePreviewResolution = {
  label: 'thumbnail' | 'small' | 'medium' | 'large';
  width: number;
  height: number;
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

export type GenerateImagePreviewResult = {
  width: number;
  height: number;
  aspectRatio: number;
  resolutions: ImagePreviewResolution[];
};

const RESOLUTION_TARGETS: Array<{
  label: ImagePreviewResolution['label'];
  maxWidth: number;
}> = [
  { label: 'thumbnail', maxWidth: 320 },
  { label: 'small', maxWidth: 720 },
  { label: 'medium', maxWidth: 1680 },
  { label: 'large', maxWidth: 2560 },
];

const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function resolveOutputFormat(mimeType: string): {
  mimeType: string;
  extension: string;
  format: 'jpeg' | 'png' | 'webp';
} {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/png') {
    return { mimeType: 'image/png', extension: 'png', format: 'png' };
  }
  if (normalized === 'image/webp') {
    return { mimeType: 'image/webp', extension: 'webp', format: 'webp' };
  }
  return { mimeType: 'image/jpeg', extension: 'jpg', format: 'jpeg' };
}

export async function generateWatermarkedImagePreviews(input: {
  originalBuffer: Buffer;
  mimeType: string;
  watermarkText?: string;
  maxInputBytes?: number;
}): Promise<GenerateImagePreviewResult> {
  const config = getPdfPreviewConfig();
  const normalizedMime = input.mimeType.trim().toLowerCase();

  if (!SUPPORTED_IMAGE_MIME.has(normalizedMime)) {
    throw new ServiceError(
      'Tipo de imagem não suportado para preview.',
      'PREVIEW_UNSUPPORTED_CONTENT_TYPE',
      415,
    );
  }

  if (!input.originalBuffer.length) {
    throw new ServiceError('Imagem original vazia.', 'PREVIEW_EMPTY_INPUT', 400);
  }

  const maxInputBytes = input.maxInputBytes ?? config.maxInputBytes;
  if (input.originalBuffer.length > maxInputBytes) {
    throw new ServiceError(
      'Imagem excede o limite para geração de preview.',
      'PREVIEW_INPUT_TOO_LARGE',
      413,
    );
  }

  const metadata = await sharp(input.originalBuffer, { failOn: 'none' }).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (!sourceWidth || !sourceHeight) {
    throw new ServiceError('Não foi possível ler dimensões da imagem.', 'PREVIEW_IMAGE_INVALID', 422);
  }

  const output = resolveOutputFormat(normalizedMime);
  const imageQuality = Math.min(100, Math.max(70, config.imagePreviewQuality));
  const resolutions: ImagePreviewResolution[] = [];

  for (const target of RESOLUTION_TARGETS) {
    const resizedPipeline = sharp(input.originalBuffer, { failOn: 'none' })
      .rotate()
      .resize({ width: target.maxWidth, withoutEnlargement: true });

    const resizedBuffer = await resizedPipeline.toBuffer();
    const resizedMeta = await sharp(resizedBuffer).metadata();
    const width = resizedMeta.width ?? target.maxWidth;
    const height = resizedMeta.height ?? sourceHeight;
    const watermarkOverlay = await buildDoqynLogoWatermarkOverlay(width, height);

    let pipeline = sharp(resizedBuffer).composite([
      {
        input: watermarkOverlay,
        top: 0,
        left: 0,
      },
    ]);

    if (output.format === 'png') {
      pipeline = pipeline.png();
    } else if (output.format === 'webp') {
      pipeline = pipeline.webp({ quality: imageQuality });
    } else {
      pipeline = pipeline.jpeg({ quality: imageQuality, mozjpeg: true });
    }

    const buffer = await pipeline.toBuffer();

    resolutions.push({
      label: target.label,
      width,
      height,
      buffer,
      mimeType: output.mimeType,
      extension: output.extension,
    });
  }

  return {
    width: sourceWidth,
    height: sourceHeight,
    aspectRatio: sourceHeight > 0 ? Number((sourceWidth / sourceHeight).toFixed(4)) : 1,
    resolutions,
  };
}
