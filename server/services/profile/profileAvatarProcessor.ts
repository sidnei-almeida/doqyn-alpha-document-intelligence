import sharp from 'sharp';
import { getProfileAvatarConfig } from './profileAvatarConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';

export type ProcessedAvatarVariant = {
  size: number;
  buffer: Buffer;
  contentType: string;
  extension: 'webp' | 'png';
  width: number;
  height: number;
};

export type ProcessedAvatarResult = {
  variants: ProcessedAvatarVariant[];
  primarySize: number;
};

export async function processProfileAvatarImage(input: {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<ProcessedAvatarResult> {
  const config = getProfileAvatarConfig();
  const extension = config.outputFormat;
  const contentType = extension === 'png' ? 'image/png' : 'image/webp';

  const pipeline = sharp(input.buffer, { failOn: 'error' }).rotate();

  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new ServiceError('Não foi possível ler as dimensões da imagem.', 'AVATAR_INVALID_IMAGE', 415);
  }

  if (width > 4096 || height > 4096) {
    throw new ServiceError('Imagem muito grande. Use até 4096×4096 px.', 'AVATAR_DIMENSIONS_TOO_LARGE', 413);
  }

  const square = Math.min(width, height);
  const left = Math.floor((width - square) / 2);
  const top = Math.floor((height - square) / 2);

  const cropped = sharp(input.buffer).rotate().extract({
    left,
    top,
    width: square,
    height: square,
  });

  const variants: ProcessedAvatarVariant[] = [];

  for (const size of config.sizes) {
    const resizedBuffer =
      extension === 'png'
        ? await cropped
            .clone()
            .resize(size, size, { fit: 'cover', withoutEnlargement: false })
            .png()
            .toBuffer({ resolveWithObject: true })
        : await cropped
            .clone()
            .resize(size, size, { fit: 'cover', withoutEnlargement: false })
            .webp({ quality: 85 })
            .toBuffer({ resolveWithObject: true });

    const resized = resizedBuffer;

    variants.push({
      size,
      buffer: resized.data,
      contentType,
      extension,
      width: resized.info.width,
      height: resized.info.height,
    });
  }

  const primarySize = config.sizes.includes(128)
    ? 128
    : (config.sizes[config.sizes.length - 1] ?? 128);

  return { variants, primarySize };
}
