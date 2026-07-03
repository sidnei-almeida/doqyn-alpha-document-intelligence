import sharp from 'sharp';
import { getPdfPreviewConfig } from './previewConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

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
  { label: 'medium', maxWidth: 1440 },
  { label: 'large', maxWidth: 2400 },
];

const SUPPORTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function buildWatermarkSvg(width: number, height: number, text: string): string {
  const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.08));
  const stepX = Math.round(width * 0.45);
  const stepY = Math.round(height * 0.35);
  const labels: string[] = [];

  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      labels.push(
        `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(180,180,180,0.28)" transform="rotate(-35 ${x} ${y})">${text}</text>`,
      );
    }
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`;
}

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

  const watermarkText = (input.watermarkText?.trim() || config.watermarkText).slice(0, 32);
  const output = resolveOutputFormat(normalizedMime);
  const resolutions: ImagePreviewResolution[] = [];

  for (const target of RESOLUTION_TARGETS) {
    const resizedPipeline = sharp(input.originalBuffer, { failOn: 'none' })
      .rotate()
      .resize({ width: target.maxWidth, withoutEnlargement: true });

    const resizedBuffer = await resizedPipeline.toBuffer();
    const resizedMeta = await sharp(resizedBuffer).metadata();
    const width = resizedMeta.width ?? target.maxWidth;
    const height = resizedMeta.height ?? sourceHeight;
    const watermarkSvg = buildWatermarkSvg(width, height, watermarkText);

    let pipeline = sharp(resizedBuffer).composite([
      {
        input: Buffer.from(watermarkSvg),
        top: 0,
        left: 0,
      },
    ]);

    if (output.format === 'png') {
      pipeline = pipeline.png();
    } else if (output.format === 'webp') {
      pipeline = pipeline.webp({ quality: 85 });
    } else {
      pipeline = pipeline.jpeg({ quality: 85 });
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
